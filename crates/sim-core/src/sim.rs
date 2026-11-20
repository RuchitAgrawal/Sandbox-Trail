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