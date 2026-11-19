use crate::clock::Tick;
use crate::invariants::InvariantStatus;
use crate::raft::rpc::{LogEntry, NodeId, RpcType, Term};
use crate::raft::node::HEARTBEAT_INTERVAL;
use crate::raft::RaftNode;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SimSnapshot {
    pub tick: Tick,
    pub nodes: Vec<NodeSnapshot>,
    pub in_flight_packets: Vec<PacketSnapshot>,
    pub links: Vec<LinkSnapshot>,
    pub invariant_status: InvariantStatus,
    pub global_event_log: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NodeSnapshot {
    pub id: NodeId,
    pub role: String, // "Leader", "Candidate", "Follower", "Crashed"
    pub current_term: Term,
    pub voted_for: Option<NodeId>,
    pub commit_index: u64,
    pub last_applied: u64,
    pub log_length: u64,
    pub log_entries: Vec<LogEntry>,
    pub election_timeout_progress: f32, // 0.0 to 1.0
    pub heartbeat_progress: f32,        // 0.0 to 1.0 (for leaders)
    pub node_log: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PacketSnapshot {
    pub id: u64,
    pub from: NodeId,
    pub to: NodeId,
    pub sent_at: Tick,
    pub deliver_at: Tick,
    pub progress: f32, // 0.0 to 1.0