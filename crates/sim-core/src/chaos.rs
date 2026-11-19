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