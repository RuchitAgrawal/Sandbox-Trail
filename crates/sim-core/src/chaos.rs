use crate::clock::Tick;
use crate::network::VirtualNetwork;
use crate::raft::rpc::NodeId;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum ChaosAction {
    SetPartition { a: NodeId, b: NodeId, partitioned: bool },
    SetLinkLatency { a: NodeId, b: NodeId, base_ms: u64, extra_lag_ms: u64 },
    SetLinkDropRate { a: NodeId, b: NodeId, drop_rate: f32 },
    ToggleCrash { node: NodeId },
    IsolateNode { node: NodeId },
    ClientWrite { node: NodeId, cmd: String },
    HealAllPartitions,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimedChaosAction {
    pub at_tick: Tick,
    pub action: ChaosAction,
}

pub fn apply_action(action: &ChaosAction, net: &mut VirtualNetwork, nodes: &mut [crate::raft::RaftNode], current_tick: Tick, clock: &mut crate::clock::VirtualClock) {
    match action {
        ChaosAction::SetPartition { a, b, partitioned } => {
            net.set_partition(*a, *b, *partitioned);
        }
        ChaosAction::SetLinkLatency { a, b, base_ms, extra_lag_ms } => {
            net.set_latency(*a, *b, *base_ms, *extra_lag_ms);
        }
        ChaosAction::SetLinkDropRate { a, b, drop_rate } => {
            net.set_drop_rate(*a, *b, *drop_rate);
        }
        ChaosAction::ToggleCrash { node } => {
            if let Some(n) = nodes.iter_mut().find(|n| n.id == *node) {
                n.toggle_crash(current_tick, clock);
            }
        }
        ChaosAction::IsolateNode { node } => {
            for peer in 0..nodes.len() as u32 {
                if peer != *node {
                    net.set_partition(*node, peer, true);
                }
            }
        }
        ChaosAction::ClientWrite { node, cmd } => {
            if let Some(n) = nodes.iter_mut().find(|n| n.id == *node) {
                let mut outbox = Vec::new();
                n.handle_client_write(cmd.clone(), current_tick, &mut outbox);
                for out in outbox {
                    net.enqueue(*node, out.to, out.payload, current_tick, clock);
                }
            }
        }
        ChaosAction::HealAllPartitions => {
            net.heal_all();
        }
    }
}
