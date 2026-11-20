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

    pub fn clear(&mut self) {
        self.buffer.clear();
    }
}

#[wasm_bindgen]
pub struct SimulationController {
    state: SimState,
    ring_buffer: SnapshotRingBuffer,
    event_log: EventLog,
    last_snapshot_tick: Tick,
}

#[wasm_bindgen]
impl SimulationController {
    #[wasm_bindgen(constructor)]
    pub fn new(node_count: u32, seed: u64) -> SimulationController {
        console_error_panic_hook::set_once();

        let count = (node_count as usize).clamp(3, 15);
        let mut controller = SimulationController {
            state: SimState::new(count, seed),
            ring_buffer: SnapshotRingBuffer::new(RING_BUFFER_CAPACITY),
            event_log: EventLog::new(seed, node_count),
            last_snapshot_tick: 0,
        };

        // Capture initial snapshot
        controller.ring_buffer.push(controller.state.take_snapshot());
        controller
    }

    pub fn tick(&mut self, delta_ms: u64) {
        self.state.tick(delta_ms);

        let current_tick = self.state.clock.current_tick;
        if current_tick.saturating_sub(self.last_snapshot_tick) >= SNAPSHOT_INTERVAL_TICKS {
            self.ring_buffer.push(self.state.take_snapshot());
            self.last_snapshot_tick = current_tick;
        }
    }

    pub fn get_snapshot(&self) -> Result<JsValue, JsValue> {
        let snap = self.state.take_snapshot();
        serde_wasm_bindgen::to_value(&snap)