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
    pub rpc_type: RpcType,
    pub summary: String,
    pub dropped: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LinkSnapshot {
    pub a: NodeId,
    pub b: NodeId,
    pub partitioned: bool,
    pub base_latency_ms: u64,
    pub jitter_ms: u64,
    pub drop_rate: f32,
    pub extra_lag_ms: u64,
}

impl SimSnapshot {
    pub fn create_node_snapshot(node: &RaftNode) -> NodeSnapshot {
        let role_str = match &node.role {
            crate::raft::Role::Leader => "Leader",
            crate::raft::Role::Candidate { .. } => "Candidate",
            crate::raft::Role::Follower => "Follower",
            crate::raft::Role::Crashed => "Crashed",
        };

        let election_progress = if node.is_crashed() || matches!(node.role, crate::raft::Role::Leader) {
            0.0
        } else {
            (node.ticks_since_heartbeat as f32 / node.election_timeout as f32).clamp(0.0, 1.0)
        };

        let heartbeat_progress = if matches!(node.role, crate::raft::Role::Leader) {
            (node.ticks_since_heartbeat as f32 / HEARTBEAT_INTERVAL as f32).clamp(0.0, 1.0)
        } else {
            0.0
        };

        NodeSnapshot {
            id: node.id,
            role: role_str.to_string(),
            current_term: node.current_term,
            voted_for: node.voted_for,
            commit_index: node.commit_index,
            last_applied: node.last_applied,
            log_length: node.log.last_log_index(),
            log_entries: node.log.all_entries().to_vec(),
            election_timeout_progress: election_progress,
            heartbeat_progress,
            node_log: node.node_log.clone(),
        }
    }
}
