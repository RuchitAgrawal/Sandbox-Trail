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
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();

      // Draw cut symbol at midpoint
      const mx = (na.x + nb.x) / 2;
      const my = (na.y + nb.y) / 2;
      drawCutSymbol(ctx, mx, my);
    } else {
      // Normal or customized link
      if (link.extra_lag_ms > 0) {
        ctx.strokeStyle = '#f59e0b'; // Amber for high lag
        ctx.setLineDash([4, 4]);
      } else if (link.drop_rate > 0) {
        ctx.strokeStyle = '#f87171'; // Red-tinted for flaky loss
        ctx.setLineDash([2, 2]);
      } else {
        ctx.strokeStyle = isSelected ? '#5e6ad2' : '#23252a';
        ctx.setLineDash([]);
      }
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawCutSymbol(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = '#0d0e11';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Small red 'X'
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 4);
  ctx.lineTo(x + 4, y + 4);
  ctx.moveTo(x + 4, y - 4);
  ctx.lineTo(x - 4, y + 4);
  ctx.stroke();
  ctx.restore();
}

function drawPackets(
  ctx: CanvasRenderingContext2D,
  packets: PacketSnapshot[],
  nodeMap: Map<number, NodeLayout>
) {
  for (const pkt of packets) {
    const na = nodeMap.get(pkt.from);
    const nb = nodeMap.get(pkt.to);
    if (!na || !nb) continue;

    // Linear interpolation
    const progress = Math.max(0, Math.min(1, pkt.progress));
    const x = na.x + progress * (nb.x - na.x);
    const y = na.y + progress * (nb.y - na.y);

    if (pkt.dropped) {
      // Render dropped burst animation
      drawDropBurst(ctx, x, y);
    } else {
      drawPacketDot(ctx, x, y, pkt.rpc_type);
    }
  }
}

function drawDropBurst(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;

  // Red burst explosion
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5);
  ctx.lineTo(x + 5, y + 5);
  ctx.moveTo(x + 5, y - 5);
  ctx.lineTo(x - 5, y + 5);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.stroke();

  ctx.restore();
}

function drawPacketDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rpcType: RpcType
) {
  const color = RPC_COLORS[rpcType] || '#f7f8f8';
  const label = RPC_SHORT_LABELS[rpcType] || '';

  ctx.save();

  // Outer glow halo
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;

  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Inner dot
  ctx.fillStyle = '#010102';
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Small pill label next to packet
  ctx.fillStyle = color;
  ctx.font = '500 9px Geist Mono, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 8, y);

  ctx.restore();
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: NodeSnapshot[],
  nodeMap: Map<number, NodeLayout>,
  options: RenderOptions
) {
  const nodeRadius = 32;

  for (const node of nodes) {
    const pos = nodeMap.get(node.id);
    if (!pos) continue;

    const isSelected = options.selectedNodeId === node.id;
    const isHovered = options.hoveredNodeId === node.id;

    ctx.save();

    // 1. Outer Progress Ring (Election timer or Leader Heartbeat)
    drawTimerRing(ctx, pos.x, pos.y, nodeRadius, node);

    // 2. Node Background Circle
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);

    if (node.role === 'Leader') {
      ctx.fillStyle = '#0d1d17';
      ctx.strokeStyle = isSelected ? '#34d399' : '#10b981';