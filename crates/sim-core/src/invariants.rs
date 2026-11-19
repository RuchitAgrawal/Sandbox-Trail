use crate::raft::rpc::{NodeId, Term};
use crate::raft::{RaftNode, Role};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum CheckResult {
    Ok,
    Violated { description: String },
}

impl CheckResult {
    pub fn is_ok(&self) -> bool {
        matches!(self, CheckResult::Ok)
    }

    pub fn is_violated(&self) -> bool {
        !self.is_ok()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvariantStatus {
    pub election_safety: CheckResult,
    pub log_matching: CheckResult,
    pub leader_acknowledged: bool,
    pub current_leader: Option<NodeId>,
    pub leader_term: Option<Term>,
}

pub fn check_invariants(nodes: &[RaftNode]) -> InvariantStatus {
    let election_safety = check_election_safety(nodes);
    let log_matching = check_log_matching(nodes);

    let mut current_leader = None;