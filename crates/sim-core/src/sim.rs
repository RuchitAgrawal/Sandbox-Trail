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