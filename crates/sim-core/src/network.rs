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