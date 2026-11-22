import { NodeLayout, Point } from './layout';

export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export function findNodeAt(
  x: number,
  y: number,
  layout: NodeLayout[],
  hitRadius: number = 40
): number | null {
  for (const node of layout) {
    if (distance({ x, y }, { x: node.x, y: node.y }) <= hitRadius) {
      return node.id;
    }
  }
  return null;
}

// Distance from point to line segment
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return distance(p, a);

  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));

  const proj = {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };

  return distance(p, proj);
}

export function findLinkNear(
  x: number,
  y: number,
  links: { a: number; b: number }[],
  layout: NodeLayout[],
  threshold: number = 14
): { a: number; b: number } | null {
  const nodeMap = new Map(layout.map((n) => [n.id, n]));

  for (const link of links) {
    const na = nodeMap.get(link.a);
    const nb = nodeMap.get(link.b);
    if (!na || !nb) continue;

    const d = distanceToSegment({ x, y }, na, nb);
    if (d <= threshold) {
      return { a: link.a, b: link.b };
    }
  }

  return null;
}

// Line-segment intersection test (Cramer's rule / CCW check)
function ccw(a: Point, b: Point, c: Point): boolean {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

export function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

export function findIntersectedLinks(
  lineStart: Point,
  lineEnd: Point,
  links: { a: number; b: number }[],
  layout: NodeLayout[]
): { a: number; b: number }[] {
  const nodeMap = new Map(layout.map((n) => [n.id, n]));
  const intersected: { a: number; b: number }[] = [];

  for (const link of links) {
    const na = nodeMap.get(link.a);
    const nb = nodeMap.get(link.b);
    if (!na || !nb) continue;

    if (segmentsIntersect(lineStart, lineEnd, na, nb)) {
      intersected.push(link);
    }
  }

  return intersected;
}
