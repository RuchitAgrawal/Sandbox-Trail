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
                description: format!(
                    "Election Safety Violated: Multiple leaders detected in term {}: {:?}",
                    term, leaders
                ),
            };
        }
    }

    CheckResult::Ok
}

pub fn check_log_matching(nodes: &[RaftNode]) -> CheckResult {
    // If two nodes both have an entry at index i with term t, their logs
    // must match on all entries from 1 up to i.
    for i in 0..nodes.len() {
        for j in (i + 1)..nodes.len() {
            let log_a = &nodes[i].log;
            let log_b = &nodes[j].log;

            let min_len = log_a.all_entries().len().min(log_b.all_entries().len());
            for idx in 1..min_len {
                let entry_a = &log_a.all_entries()[idx];
                let entry_b = &log_b.all_entries()[idx];

                if entry_a.term == entry_b.term {
                    // Check all previous entries
                    for prev_idx in 1..=idx {
                        let prev_a = &log_a.all_entries()[prev_idx];
                        let prev_b = &log_b.all_entries()[prev_idx];
                        if prev_a != prev_b {
                            return CheckResult::Violated {
                                description: format!(
                                    "Log Matching Violated: Divergence at index {} between Node {} and Node {} despite matching term at index {}",
                                    prev_idx, nodes[i].id, nodes[j].id, idx
                                ),
                            };
                        }
                    }
                }
            }
        }
    }

    CheckResult::Ok
}
