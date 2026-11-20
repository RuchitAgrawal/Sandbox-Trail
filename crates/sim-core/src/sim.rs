use crate::chaos::ChaosAction;
use crate::clock::VirtualClock;
use crate::invariants::{self, InvariantStatus};
use crate::network::VirtualNetwork;
use crate::raft::node::OutgoingPacket;
use crate::raft::rpc::{ClientWriteAck, NodeId};
use crate::raft::RaftNode;
use crate::snapshot::{LinkSnapshot, NodeSnapshot, PacketSnapshot, SimSnapshot};

pub const MAX_TICK_CLAMP: u64 = 50;

#[derive(Clone, Debug)]
pub struct SimState {
    pub clock: VirtualClock,
    pub network: VirtualNetwork,
    pub nodes: Vec<RaftNode>,
    pub global_event_log: Vec<String>,
}

impl SimState {
    pub fn new(node_count: usize, seed: u64) -> Self {
        let mut clock = VirtualClock::new(seed);
        let mut nodes = Vec::with_capacity(node_count);

        for id in 0..node_count as u32 {
            let peers = (0..node_count as u32).filter(|&p| p != id).collect();
            nodes.push(RaftNode::new(id, peers, &mut clock));
        }

        Self {
            clock,
            network: VirtualNetwork::new(),
            nodes,
            global_event_log: vec![format!(
                "Cluster initialized with {} nodes (seed: {})",
                node_count, seed
            )],
        }
    }

    pub fn log_event(&mut self, msg: String) {
        if self.global_event_log.len() >= 200 {
            self.global_event_log.remove(0);
        }
        self.global_event_log
            .push(format!("[{}ms] {}", self.clock.current_tick, msg));
    }

    pub fn step_one_ms(&mut self) {
        self.clock.advance_one_ms();
        let current_tick = self.clock.current_tick;

        // Prune expired visual drops
        self.network.prune_visual_drops(current_tick);

        // 1. Drain deliverable packets
        let deliverable = self.network.drain_due(current_tick);

        let mut outbox: Vec<(NodeId, OutgoingPacket)> = Vec::new();

        // 2. Deliver packets to target nodes
        for pkt in deliverable {
            if let Some(target_node) = self.nodes.iter_mut().find(|n| n.id == pkt.to) {
                let mut node_out = Vec::new();
                target_node.handle_packet(
                    pkt.from,
                    pkt.payload,
                    current_tick,
                    &mut self.clock,
                    &mut node_out,
                );
                for out in node_out {
                    outbox.push((target_node.id, out));
                }
            }
        }

        // 3. Tick each node's internal state machine
        for node in &mut self.nodes {
            let mut node_out = Vec::new();
            node.tick(1, current_tick, &mut self.clock, &mut node_out);
            for out in node_out {
                outbox.push((node.id, out));
            }
        }

        // 4. Enqueue outgoing RPCs into virtual network
        for (from, out) in outbox {
            self.network
                .enqueue(from, out.to, out.payload, current_tick, &mut self.clock);
        }
    }

    pub fn tick(&mut self, delta_ms: u64) {
        // Clamp to avoid spiral-of-death when tab is backgrounded
        let steps = delta_ms.min(MAX_TICK_CLAMP);
        for _ in 0..steps {
            self.step_one_ms();
        }
    }

    pub fn client_write(&mut self, node_id: NodeId, cmd: String) -> ClientWriteAck {
        let current_tick = self.clock.current_tick;
        let mut outbox = Vec::new();

        let ack = if let Some(node) = self.nodes.iter_mut().find(|n| n.id == node_id) {
            let ack = node.handle_client_write(cmd.clone(), current_tick, &mut outbox);
            if ack.success {
                self.log_event(format!(
                    "Client write '{}' accepted by Leader {} at index {}",
                    cmd, node_id, ack.index
                ));
            } else {
                self.log_event(format!(
                    "Client write '{}' rejected by Node {} (not leader)",
                    cmd, node_id
                ));
            }
            ack
        } else {
            ClientWriteAck {
                success: false,
                leader_hint: None,
                index: 0,
            }
        };

        for out in outbox {
            self.network
                .enqueue(node_id, out.to, out.payload, current_tick, &mut self.clock);
        }

        ack
    }

    pub fn set_partition(&mut self, a: NodeId, b: NodeId, partitioned: bool) {
        self.network.set_partition(a, b, partitioned);
        if partitioned {
            self.log_event(format!("Network partition cut between Node {} and Node {}", a, b));
        } else {
            self.log_event(format!("Network partition healed between Node {} and Node {}", a, b));
        }
    }

    pub fn set_link_latency(&mut self, a: NodeId, b: NodeId, base_ms: u64, extra_lag_ms: u64) {
        self.network.set_latency(a, b, base_ms, extra_lag_ms);
    }

    pub fn set_link_drop_rate(&mut self, a: NodeId, b: NodeId, drop_rate: f32) {
        self.network.set_drop_rate(a, b, drop_rate);
    }

    pub fn toggle_crash(&mut self, node_id: NodeId) {
        let current_tick = self.clock.current_tick;
        if let Some(node) = self.nodes.iter_mut().find(|n| n.id == node_id) {
            node.toggle_crash(current_tick, &mut self.clock);
            let state = if node.is_crashed() { "crashed" } else { "restarted" };
            self.log_event(format!("Node {} was {}", node_id, state));
        }
    }

    pub fn apply_chaos(&mut self, action: &ChaosAction) {
        let current_tick = self.clock.current_tick;
        crate::chaos::apply_action(
            action,
            &mut self.network,
            &mut self.nodes,
            current_tick,
            &mut self.clock,
        );
    }

    pub fn check_invariants(&self) -> InvariantStatus {
        invariants::check_invariants(&self.nodes)
    }

    pub fn take_snapshot(&self) -> SimSnapshot {
        let current_tick = self.clock.current_tick;
        let nodes: Vec<NodeSnapshot> = self.nodes.iter().map(SimSnapshot::create_node_snapshot).collect();

        let mut in_flight_packets: Vec<PacketSnapshot> = Vec::new();

        // 1. Packets actively in-flight
        for pkt in self.network.iter_in_flight() {
            let duration = (pkt.deliver_at.saturating_sub(pkt.sent_at)).max(1);
            let elapsed = current_tick.saturating_sub(pkt.sent_at);
            let progress = (elapsed as f32 / duration as f32).clamp(0.0, 1.0);

            let rpc_type = pkt.payload.rpc_type();
            let summary = format!("{:?}", rpc_type);

            in_flight_packets.push(PacketSnapshot {
                id: pkt.id,
                from: pkt.from,
                to: pkt.to,
                sent_at: pkt.sent_at,
                deliver_at: pkt.deliver_at,
                progress,
                rpc_type,
                summary,