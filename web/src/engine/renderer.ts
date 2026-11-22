import { LinkSnapshot, NodeSnapshot, PacketSnapshot, RpcType, SimSnapshot } from '../types/sim';
import { NodeLayout, Point } from './layout';

export interface RenderOptions {
  selectedNodeId: number | null;
  selectedLink: { a: number; b: number } | null;
  hoveredNodeId: number | null;
  scissorStart: Point | null;
  scissorEnd: Point | null;
}

const RPC_COLORS: Record<RpcType, string> = {
  Heartbeat: '#60a5fa',
  AppendEntries: '#22d3ee',
  AppendEntriesSuccess: '#34d399',
  AppendEntriesReject: '#fb923c',
  RequestVote: '#c084fc',
  VoteGranted: '#f472b6',
  VoteDenied: '#f87171',
  ClientWrite: '#fbbf24',
  ClientWriteAck: '#a3e635',
};

const RPC_SHORT_LABELS: Record<RpcType, string> = {
  Heartbeat: 'HB',
  AppendEntries: 'AE',
  AppendEntriesSuccess: 'OK',
  AppendEntriesReject: 'NO',
  RequestVote: 'RV',
  VoteGranted: 'VG',
  VoteDenied: 'VD',
  ClientWrite: 'W',
  ClientWriteAck: 'ACK',
};

export function renderSimulation(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  snapshot: SimSnapshot | null,
  layout: NodeLayout[],
  options: RenderOptions
): void {
  // Clear canvas with deep #010102
  ctx.fillStyle = '#010102';
  ctx.fillRect(0, 0, width, height);

  if (!snapshot || layout.length === 0) {
    drawEmptyState(ctx, width, height);
    return;