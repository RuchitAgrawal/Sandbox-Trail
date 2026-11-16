use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap};
use serde::{Deserialize, Serialize};
use crate::clock::{Tick, VirtualClock};

pub type NodeId = u32;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LinkConfig {
    pub from: NodeId,
    pub to: NodeId,
    pub latency_ms: u64,
    pub jitter_ms: u64,
    pub drop_rate: f32,
    pub is_partitioned: bool,
}

#[derive(Clone, Debug)]
pub struct Packet<P> {
    pub id: u64,
    pub from: NodeId,
    pub to: NodeId,
    pub payload: P,
    pub sent_at_tick: Tick,
    pub deliver_at_tick: Tick,
}
