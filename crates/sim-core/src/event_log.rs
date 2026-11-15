use crate::chaos::ChaosAction;
use crate::clock::Tick;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UserActionRecord {
    pub at_tick: Tick,
    pub action: ChaosAction,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventLog {
    pub seed: u64,
    pub cluster_size: u32,
    pub actions: Vec<UserActionRecord>,
}

impl EventLog {
    pub fn new(seed: u64, cluster_size: u32) -> Self {
        Self {
            seed,
            cluster_size,
            actions: Vec::new(),
        }
    }

    pub fn record(&mut self, at_tick: Tick, action: ChaosAction) {
        self.actions.push(UserActionRecord { at_tick, action });
    }

    pub fn clear(&mut self) {
        self.actions.clear();
    }
}
