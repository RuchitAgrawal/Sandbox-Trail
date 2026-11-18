use serde::{Deserialize, Serialize};
use crate::raft::rpc::LogEntry;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReplicatedLog {
    pub entries: Vec<LogEntry>,
}
