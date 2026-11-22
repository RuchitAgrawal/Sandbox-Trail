export interface Point {
  x: number;
  y: number;
}

export interface NodeLayout {
  id: number;
  x: number;
  y: number;
}

const customNodePositions = new Map<number, Point>();

export function getCustomNodePositions(): Map<number, Point> {
  return customNodePositions;
}

export function setCustomNodePosition(id: number, pos: Point): void {
  customNodePositions.set(id, pos);
}

export function resetCustomPositions(): void {
  customNodePositions.clear();
}

export function calculateNodeLayout(
  nodeCount: number,
  width: number,
  height: number,
  nodeRadius: number = 36
): NodeLayout[] {
  const layouts: NodeLayout[] = [];
  const cx = width / 2;
  const cy = height / 2;

  // Use min dimension minus padding for layout circle
  const maxRadius = Math.min(width, height) / 2 - (nodeRadius + 60);
  const radius = Math.max(120, maxRadius);

  for (let i = 0; i < nodeCount; i++) {
    if (customNodePositions.has(i)) {
      const custom = customNodePositions.get(i)!;
      layouts.push({ id: i, x: custom.x, y: custom.y });
    } else {
      // Symmetrical circle layout starting from top (-PI/2)
      const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      layouts.push({ id: i, x, y });
    }
  }

  return layouts;
}
