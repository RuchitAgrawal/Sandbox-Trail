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
  }

  const nodeMap = new Map<number, NodeLayout>(layout.map((n) => [n.id, n]));

  // 1. Draw Links (topology lines and partitions)
  drawLinks(ctx, snapshot.links, nodeMap, options);

  // 2. Draw In-flight & Dropped Packets
  drawPackets(ctx, snapshot.in_flight_packets, nodeMap);

  // 3. Draw Nodes (State machines, timers, terms, logs)
  drawNodes(ctx, snapshot.nodes, nodeMap, options);

  // 4. Draw Scissor Cut preview
  if (options.scissorStart && options.scissorEnd) {
    drawScissorPreview(ctx, options.scissorStart, options.scissorEnd);
  }
}

function drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#8a8f98';
  ctx.font = '14px Geist Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Initializing deterministic simulator...', width / 2, height / 2);
}

function drawLinks(
  ctx: CanvasRenderingContext2D,
  links: LinkSnapshot[],
  nodeMap: Map<number, NodeLayout>,
  options: RenderOptions
) {
  for (const link of links) {
    const na = nodeMap.get(link.a);
    const nb = nodeMap.get(link.b);
    if (!na || !nb) continue;

    const isSelected =
      options.selectedLink &&
      ((options.selectedLink.a === link.a && options.selectedLink.b === link.b) ||
        (options.selectedLink.a === link.b && options.selectedLink.b === link.a));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(na.x, na.y);
    ctx.lineTo(nb.x, nb.y);

    if (link.partitioned) {
      // Partitioned link: Red dashed line with scissor cut mark