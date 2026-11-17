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
            ticks_since_heartbeat: 0,
            peers,
            node_log: vec![format!("Initialized as Follower (timeout: {}ms)", election_timeout)],
        }
    }

    pub fn cluster_size(&self) -> usize {
        self.peers.len() + 1
    }

    pub fn majority(&self) -> usize {
        (self.cluster_size() / 2) + 1
    }

    pub fn log_event(&mut self, current_tick: Tick, msg: String) {
        if self.node_log.len() >= 100 {
            self.node_log.remove(0);
        }
        self.node_log.push(format!("[{}ms T{}] {}", current_tick, self.current_term, msg));
    }

    pub fn is_crashed(&self) -> bool {
        matches!(self.role, Role::Crashed)
    }

    pub fn toggle_crash(&mut self, current_tick: Tick, clock: &mut VirtualClock) {
        if self.is_crashed() {
            // Restart: preserve persistent state (term, voted_for, log)
            self.role = Role::Follower;
            self.ticks_since_heartbeat = 0;
            self.election_timeout = clock.rand_range(ELECTION_TIMEOUT_MIN, ELECTION_TIMEOUT_MAX);
            self.next_index.clear();
            self.match_index.clear();
            self.log_event(current_tick, "Node restarted from crash".to_string());
        } else {
            self.role = Role::Crashed;
            self.log_event(current_tick, "Node crashed".to_string());
        }
    }

    pub fn tick(
        &mut self,
        dt: Tick,
        current_tick: Tick,
        clock: &mut VirtualClock,
        outbox: &mut Vec<OutgoingPacket>,
    ) {
        if self.is_crashed() {
            return;
        }

        self.ticks_since_heartbeat += dt;

        match &self.role {
            Role::Follower => {
                if self.ticks_since_heartbeat >= self.election_timeout {
                    self.start_election(current_tick, clock, outbox);
                }
            }
            Role::Candidate { .. } => {
                if self.ticks_since_heartbeat >= self.election_timeout {
                    self.start_election(current_tick, clock, outbox);
                }
            }
            Role::Leader => {
                if self.ticks_since_heartbeat >= HEARTBEAT_INTERVAL {
                    self.send_heartbeats(outbox);
                    self.ticks_since_heartbeat = 0;
                }
            }
            Role::Crashed => {}
        }
    }

    pub fn start_election(
        &mut self,
        current_tick: Tick,
        clock: &mut VirtualClock,
        outbox: &mut Vec<OutgoingPacket>,
    ) {
        self.current_term += 1;
        let mut votes = HashSet::new();
        votes.insert(self.id);
        self.voted_for = Some(self.id);
        self.role = Role::Candidate {
            votes_received: votes.clone(),
        };
        self.ticks_since_heartbeat = 0;
        self.election_timeout = clock.rand_range(ELECTION_TIMEOUT_MIN, ELECTION_TIMEOUT_MAX);

        self.log_event(
            current_tick,
            format!("Election started for term {}, voted for self", self.current_term),
        );

        // Check single node cluster edge case
        if votes.len() >= self.majority() {
            self.become_leader(current_tick, outbox);
            return;
        }

        let last_log_index = self.log.last_log_index();
        let last_log_term = self.log.last_log_term();

        for &peer in &self.peers {
            outbox.push(OutgoingPacket {
                to: peer,
                payload: RpcPayload::RequestVote(RequestVoteArgs {
                    term: self.current_term,
                    candidate_id: self.id,
                    last_log_index,
                    last_log_term,
                }),
            });
        }
    }

    pub fn become_leader(&mut self, current_tick: Tick, outbox: &mut Vec<OutgoingPacket>) {
        self.role = Role::Leader;
        let next_idx = self.log.last_log_index() + 1;
        self.next_index.clear();
        self.match_index.clear();
        for &peer in &self.peers {
            self.next_index.insert(peer, next_idx);
            self.match_index.insert(peer, 0);
        }

        self.log_event(
            current_tick,
            format!("Elected Leader for term {}", self.current_term),
        );

        // Send initial heartbeat immediately
        self.send_heartbeats(outbox);
        self.ticks_since_heartbeat = 0;
    }

    pub fn send_heartbeats(&self, outbox: &mut Vec<OutgoingPacket>) {
        for &peer in &self.peers {
            let next = *self.next_index.get(&peer).unwrap_or(&(self.log.last_log_index() + 1));
            let prev_log_index = next.saturating_sub(1);
            let prev_log_term = self.log.term_at(prev_log_index).unwrap_or(0);
            let entries = self.log.slice_from(next);

            outbox.push(OutgoingPacket {
                to: peer,
                payload: RpcPayload::AppendEntries(AppendEntriesArgs {
                    term: self.current_term,
                    leader_id: self.id,
                    prev_log_index,
                    prev_log_term,
                    entries,
                    leader_commit: self.commit_index,
                }),
            });
        }
    }

    pub fn handle_client_write(
        &mut self,
        cmd: String,
        current_tick: Tick,
        outbox: &mut Vec<OutgoingPacket>,
    ) -> ClientWriteAck {
        if self.is_crashed() {
            return ClientWriteAck {
                success: false,
                leader_hint: None,
                index: 0,
            };
        }

        if !matches!(self.role, Role::Leader) {
            return ClientWriteAck {
                success: false,
                leader_hint: None,
                index: 0,
            };
        }

        let index = self.log.append(self.current_term, cmd.clone());
        self.log_event(
            current_tick,
            format!("Client write appended at index {}: {}", index, cmd),
        );

        // If single node cluster, commit immediately
        if self.majority() == 1 {
            self.commit_index = index;
            self.log_event(current_tick, format!("Committed index {}", index));
        } else {
            // Trigger early replication
            self.send_heartbeats(outbox);
        }

        ClientWriteAck {
            success: true,
            leader_hint: Some(self.id),
            index,
        }