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