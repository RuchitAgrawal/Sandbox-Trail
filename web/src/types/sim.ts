export type RoleType = 'Leader' | 'Candidate' | 'Follower' | 'Crashed';

export interface LogEntry {
  index: number;
  term: number;
  command: string;
}

export type RpcType =
  | 'RequestVote'
  | 'VoteGranted'
  | 'VoteDenied'
  | 'AppendEntries'
  | 'Heartbeat'
  | 'AppendEntriesSuccess'
  | 'AppendEntriesReject'
  | 'ClientWrite'
  | 'ClientWriteAck';

export interface NodeSnapshot {
  id: number;
  role: RoleType;
  current_term: number;
  voted_for: number | null;
  commit_index: number;
  last_applied: number;
  log_length: number;
  log_entries: LogEntry[];
  election_timeout_progress: number; // 0.0 to 1.0
  heartbeat_progress: number;        // 0.0 to 1.0
  node_log: string[];
}

export interface PacketSnapshot {
  id: number;
  from: number;
  to: number;
  sent_at: number;
  deliver_at: number;
  progress: number; // 0.0 to 1.0
  rpc_type: RpcType;
  summary: string;
  dropped: boolean;
}

export interface LinkSnapshot {
  a: number;
  b: number;
  partitioned: boolean;
  base_latency_ms: number;
  jitter_ms: number;
  drop_rate: number;
  extra_lag_ms: number;
}

export type CheckResult =
  | 'Ok'
  | { Violated: { description: string } };

export interface InvariantStatus {
  election_safety: CheckResult;
  log_matching: CheckResult;
  leader_acknowledged: boolean;
  current_leader: number | null;
  leader_term: number | null;
}

export interface SimSnapshot {
  tick: number;
  nodes: NodeSnapshot[];
  in_flight_packets: PacketSnapshot[];
  links: LinkSnapshot[];
  invariant_status: InvariantStatus;
  global_event_log: string[];
}

export interface ClientWriteAck {
  success: boolean;
  leader_hint: number | null;
  index: number;
}
