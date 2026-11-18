use super::rpc::{LogEntry, Term};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplicatedLog {
    entries: Vec<LogEntry>,
}

impl Default for ReplicatedLog {
    fn default() -> Self {
        Self::new()
    }
}

impl ReplicatedLog {
    pub fn new() -> Self {
        Self {
            entries: vec![LogEntry {
                index: 0,
                term: 0,
                command: String::new(),
            }],
        }
    }

    pub fn last_log_index(&self) -> u64 {
        self.entries.last().map(|e| e.index).unwrap_or(0)
    }

    pub fn last_log_term(&self) -> Term {
        self.entries.last().map(|e| e.term).unwrap_or(0)
    }

    pub fn get_entry(&self, index: u64) -> Option<&LogEntry> {
        let idx = index as usize;
        if idx < self.entries.len() && self.entries[idx].index == index {
            Some(&self.entries[idx])
        } else {
            self.entries.iter().find(|e| e.index == index)
        }
    }

    pub fn term_at(&self, index: u64) -> Option<Term> {
        self.get_entry(index).map(|e| e.term)
    }

    pub fn is_at_least_as_up_to_date(&self, candidate_last_index: u64, candidate_last_term: Term) -> bool {
        let my_term = self.last_log_term();
        let my_index = self.last_log_index();

        if candidate_last_term != my_term {
            candidate_last_term >= my_term
        } else {
            candidate_last_index >= my_index
        }
    }

    pub fn append(&mut self, term: Term, command: String) -> u64 {
        let index = self.last_log_index() + 1;
        self.entries.push(LogEntry {
            index,
            term,
            command,
        });
        index
    }

    pub fn append_entries_from_leader(
        &mut self,
        prev_log_index: u64,
        prev_log_term: Term,
        new_entries: &[LogEntry],
    ) -> Result<u64, ()> {
        if prev_log_index > self.last_log_index() {
            return Err(());
        }

        if let Some(entry) = self.get_entry(prev_log_index) {
            if entry.term != prev_log_term {
                return Err(());
            }
        } else {
            return Err(());
        }

        let mut insert_pos = (prev_log_index + 1) as usize;
        for new_entry in new_entries {
            if insert_pos < self.entries.len() {
                if self.entries[insert_pos].term != new_entry.term {
                    self.entries.truncate(insert_pos);
                    self.entries.push(new_entry.clone());
                }
            } else {
                self.entries.push(new_entry.clone());
            }
            insert_pos += 1;
        }

        Ok(self.last_log_index())
    }

    pub fn slice_from(&self, start_index: u64) -> Vec<LogEntry> {
        let start = start_index as usize;
        if start >= self.entries.len() {
            Vec::new()
        } else {
            self.entries[start..].to_vec()
        }
    }

    pub fn all_entries(&self) -> &[LogEntry] {
        &self.entries
    }

    pub fn try_advance_commit(
        &self,
        match_indices: &HashMap<super::rpc::NodeId, u64>,
        current_term: Term,
        cluster_size: usize,
        my_id: super::rpc::NodeId,
    ) -> Option<u64> {
        let last_index = self.last_log_index();
        let majority = (cluster_size / 2) + 1;

        let mut match_counts: Vec<u64> = Vec::new();
        for index in 1..=last_index {
            if let Some(entry) = self.get_entry(index) {
                if entry.term == current_term {
                    let mut count = 1; // leader itself matches
                    for (&peer_id, &m_idx) in match_indices {
                        if peer_id != my_id && m_idx >= index {
                            count += 1;
                        }
                    }
                    if count >= majority {
                        match_counts.push(index);
                    }
                }
            }
        }

        match_counts.into_iter().max()
    }
}
