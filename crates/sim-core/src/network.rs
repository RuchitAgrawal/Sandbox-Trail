use crate::clock::{Tick, VirtualClock};
use crate::raft::rpc::{NodeId, RpcPayload};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

pub const DEFAULT_BASE_LATENCY_MS: u64 = 40;
pub const DEFAULT_JITTER_MS: u64 = 10;
pub const VISUAL_DROP_DURATION_MS: Tick = 300;

pub fn link_key(a: NodeId, b: NodeId) -> (NodeId, NodeId) {
    (a.min(b), a.max(b))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Packet {
    pub id: u64,
    pub from: NodeId,
    pub to: NodeId,
    pub sent_at: Tick,
    pub deliver_at: Tick,
    pub payload: RpcPayload,
    pub dropped: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ScheduledPacket {
    pub packet: Packet,
}

impl PartialEq for ScheduledPacket {
    fn eq(&self, other: &Self) -> bool {
        self.packet.deliver_at == other.packet.deliver_at && self.packet.id == other.packet.id
    }
}

impl Eq for ScheduledPacket {}

impl PartialOrd for ScheduledPacket {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for ScheduledPacket {
    fn cmp(&self, other: &Self) -> Ordering {
        self.packet
            .deliver_at
            .cmp(&other.packet.deliver_at)
            .then_with(|| self.packet.id.cmp(&other.packet.id))
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LinkConfig {
    pub partitioned: bool,
    pub base_latency_ms: u64,
    pub jitter_ms: u64,
    pub drop_rate: f32,
    pub extra_lag_ms: u64,
}

impl Default for LinkConfig {
    fn default() -> Self {
        Self {
            partitioned: false,
            base_latency_ms: DEFAULT_BASE_LATENCY_MS,
            jitter_ms: DEFAULT_JITTER_MS,
            drop_rate: 0.0,
            extra_lag_ms: 0,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VisualDrop {
    pub packet: Packet,
    pub dropped_at_tick: Tick,
    pub display_duration_ticks: Tick,
}

#[derive(Clone, Debug)]
pub struct VirtualNetwork {
    in_flight: BinaryHeap<Reverse<ScheduledPacket>>,
    links: HashMap<(NodeId, NodeId), LinkConfig>,
    visual_drops: Vec<VisualDrop>,
    next_packet_id: u64,
}

impl Default for VirtualNetwork {
    fn default() -> Self {
        Self::new()
    }
}

impl VirtualNetwork {
    pub fn new() -> Self {
        Self {
            in_flight: BinaryHeap::new(),
            links: HashMap::new(),
            visual_drops: Vec::new(),
            next_packet_id: 1,
        }
    }

    pub fn get_link(&self, a: NodeId, b: NodeId) -> LinkConfig {
        self.links.get(&link_key(a, b)).cloned().unwrap_or_default()
    }

    pub fn get_or_insert_link(&mut self, a: NodeId, b: NodeId) -> &mut LinkConfig {
        self.links.entry(link_key(a, b)).or_default()
    }

    pub fn set_partition(&mut self, a: NodeId, b: NodeId, partitioned: bool) {
        self.get_or_insert_link(a, b).partitioned = partitioned;
    }

    pub fn set_latency(&mut self, a: NodeId, b: NodeId, base_ms: u64, extra_lag_ms: u64) {
        let link = self.get_or_insert_link(a, b);
        link.base_latency_ms = base_ms;
        link.extra_lag_ms = extra_lag_ms;
    }

    pub fn set_drop_rate(&mut self, a: NodeId, b: NodeId, drop_rate: f32) {
        self.get_or_insert_link(a, b).drop_rate = drop_rate.clamp(0.0, 1.0);
    }

    pub fn heal_all(&mut self) {
        for link in self.links.values_mut() {
            link.partitioned = false;
        }
    }

    pub fn all_links(&self) -> &HashMap<(NodeId, NodeId), LinkConfig> {
        &self.links
    }

    pub fn enqueue(
        &mut self,
        from: NodeId,
        to: NodeId,
        payload: RpcPayload,
        current_tick: Tick,
        clock: &mut VirtualClock,
    ) {
        let id = self.next_packet_id;
        self.next_packet_id += 1;

        let link = self.get_link(from, to);

        let jitter = if link.jitter_ms > 0 {
            clock.rand_range(0, link.jitter_ms)
        } else {
            0
        };

        let total_latency = (link.base_latency_ms + link.extra_lag_ms + jitter).max(1);

        let is_partitioned = link.partitioned;
        let is_flaky_drop = !is_partitioned && link.drop_rate > 0.0 && clock.gen_f32() < link.drop_rate;

        let will_drop = is_partitioned || is_flaky_drop;

        let deliver_at = if will_drop {
            current_tick + (total_latency / 2).max(1)
        } else {
            current_tick + total_latency
        };

        let packet = Packet {
            id,
            from,
            to,
            sent_at: current_tick,
            deliver_at,
            payload,
            dropped: will_drop,
        };

        self.in_flight.push(Reverse(ScheduledPacket { packet }));
    }

    pub fn drain_due(&mut self, current_tick: Tick) -> Vec<Packet> {
        let mut deliverable = Vec::new();

        while let Some(Reverse(scheduled)) = self.in_flight.peek() {
            if scheduled.packet.deliver_at <= current_tick {
                let Reverse(scheduled) = self.in_flight.pop().unwrap();
                let pkt = scheduled.packet;

                if pkt.dropped {
                    self.visual_drops.push(VisualDrop {
                        packet: pkt,
                        dropped_at_tick: current_tick,
                        display_duration_ticks: VISUAL_DROP_DURATION_MS,
                    });
                } else {
                    deliverable.push(pkt);
                }