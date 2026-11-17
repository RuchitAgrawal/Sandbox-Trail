use serde::{Deserialize, Serialize};

pub type NodeId = u32;
pub type Term = u64;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LogEntry {
    pub index: u64,
    pub term: Term,
    pub command: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum RpcPayload {
    RequestVote(RequestVoteArgs),
    RequestVoteReply(RequestVoteReply),
    AppendEntries(AppendEntriesArgs),
    AppendEntriesReply(AppendEntriesReply),
    ClientWrite(ClientWriteArgs),
    ClientWriteAck(ClientWriteAck),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RequestVoteArgs {
    pub term: Term,
    pub candidate_id: NodeId,
    pub last_log_index: u64,
    pub last_log_term: Term,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RequestVoteReply {
    pub term: Term,
    pub vote_granted: bool,
    pub from: NodeId,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppendEntriesArgs {
    pub term: Term,
    pub leader_id: NodeId,
    pub prev_log_index: u64,
    pub prev_log_term: Term,
    pub entries: Vec<LogEntry>,
    pub leader_commit: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppendEntriesReply {
    pub term: Term,
    pub success: bool,
    pub from: NodeId,
    pub match_index: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClientWriteArgs {
    pub command: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClientWriteAck {
    pub success: bool,
    pub leader_hint: Option<NodeId>,
    pub index: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum RpcType {
    RequestVote,
    VoteGranted,
    VoteDenied,
    AppendEntries,
    Heartbeat,
    AppendEntriesSuccess,
    AppendEntriesReject,
    ClientWrite,
    ClientWriteAck,
}

impl RpcPayload {
    pub fn rpc_type(&self) -> RpcType {
        match self {
            RpcPayload::RequestVote(_) => RpcType::RequestVote,
            RpcPayload::RequestVoteReply(r) => {
                if r.vote_granted {
                    RpcType::VoteGranted
                } else {
                    RpcType::VoteDenied
                }
            }
            RpcPayload::AppendEntries(a) => {
                if a.entries.is_empty() {
                    RpcType::Heartbeat
                } else {
                    RpcType::AppendEntries
                }
            }
            RpcPayload::AppendEntriesReply(r) => {
                if r.success {
                    RpcType::AppendEntriesSuccess
                } else {
                    RpcType::AppendEntriesReject
                }
            }
            RpcPayload::ClientWrite(_) => RpcType::ClientWrite,
            RpcPayload::ClientWriteAck(_) => RpcType::ClientWriteAck,
        }
    }
}
