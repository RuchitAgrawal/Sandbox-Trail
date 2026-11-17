use super::log::ReplicatedLog;
use super::rpc::{
    AppendEntriesArgs, AppendEntriesReply, ClientWriteAck, NodeId, RequestVoteArgs,
    RequestVoteReply, RpcPayload, Term,
};
use crate::clock::{Tick, VirtualClock};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

pub const HEARTBEAT_INTERVAL: Tick = 50; // ms
pub const ELECTION_TIMEOUT_MIN: Tick = 150; // ms
pub const ELECTION_TIMEOUT_MAX: Tick = 300; // ms

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Role {
    Follower,
    Candidate { votes_received: HashSet<NodeId> },
    Leader,
    Crashed,
}

#[derive(Clone, Debug)]
pub struct OutgoingPacket {
    pub to: NodeId,
    pub payload: RpcPayload,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RaftNode {
    pub id: NodeId,

    // Persistent state (§5.2) - preserved across crashes/restarts
    pub current_term: Term,
    pub voted_for: Option<NodeId>,
    pub log: ReplicatedLog,

    // Volatile state on all servers
    pub role: Role,
    pub commit_index: u64,
    pub last_applied: u64,

    // Volatile state on leaders
    pub next_index: HashMap<NodeId, u64>,
    pub match_index: HashMap<NodeId, u64>,

    // Timers
    pub election_timeout: Tick,
    pub ticks_since_heartbeat: Tick,

    // Cluster configuration
    pub peers: Vec<NodeId>,

    // Human-readable debug/event log for UI
    pub node_log: Vec<String>,
}

impl RaftNode {
    pub fn new(id: NodeId, peers: Vec<NodeId>, clock: &mut VirtualClock) -> Self {
        let election_timeout = clock.rand_range(ELECTION_TIMEOUT_MIN, ELECTION_TIMEOUT_MAX);
        Self {
            id,
            current_term: 0,
            voted_for: None,
            log: ReplicatedLog::new(),
            role: Role::Follower,
            commit_index: 0,
            last_applied: 0,
            next_index: HashMap::new(),
            match_index: HashMap::new(),
            election_timeout,