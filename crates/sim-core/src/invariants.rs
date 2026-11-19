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
    let mut leader_term = None;

    for node in nodes {
        if matches!(node.role, Role::Leader) {
            current_leader = Some(node.id);
            leader_term = Some(node.current_term);
            break;
        }
    }

    InvariantStatus {
        election_safety,
        log_matching,
        leader_acknowledged: current_leader.is_some(),
        current_leader,
        leader_term,
    }
}

pub fn check_election_safety(nodes: &[RaftNode]) -> CheckResult {
    // Group active leaders by term. There must be <= 1 leader per term.
    let mut leaders_by_term: HashMap<Term, Vec<NodeId>> = HashMap::new();

    for node in nodes {
        if matches!(node.role, Role::Leader) {
            leaders_by_term
                .entry(node.current_term)
                .or_default()
                .push(node.id);
        }
    }

    for (&term, leaders) in &leaders_by_term {
        if leaders.len() > 1 {
            return CheckResult::Violated {