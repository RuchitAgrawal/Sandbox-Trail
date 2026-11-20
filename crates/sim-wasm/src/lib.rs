use serde::{Deserialize, Serialize};
use sim_core::chaos::ChaosAction;
use sim_core::clock::Tick;
use sim_core::event_log::EventLog;
use sim_core::snapshot::SimSnapshot;
use sim_core::SimState;
use std::collections::VecDeque;
use wasm_bindgen::prelude::*;

const RING_BUFFER_CAPACITY: usize = 600; // ~5 minutes of scrubbing history at 500ms intervals
const SNAPSHOT_INTERVAL_TICKS: Tick = 500;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SnapshotRingBuffer {
    buffer: VecDeque<SimSnapshot>,
    capacity: usize,
}

impl SnapshotRingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: VecDeque::with_capacity(capacity),
            capacity,
        }
    }

    pub fn push(&mut self, snapshot: SimSnapshot) {
        if self.buffer.len() >= self.capacity {
            self.buffer.pop_front();
        }
        self.buffer.push_back(snapshot);
    }

    pub fn get(&self, index: usize) -> Option<&SimSnapshot> {
        self.buffer.get(index)
    }

    pub fn len(&self) -> usize {
        self.buffer.len()
    }

    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }
