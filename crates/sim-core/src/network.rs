use std::collections::{BinaryHeap, HashMap};
use crate::clock::{Tick, VirtualClock};

pub type NodeId = u32;

#[derive(Clone, Debug)]
pub struct VirtualNetwork {
    pub node_count: u32,
    pub routes: HashMap<(NodeId, NodeId), bool>,
}
