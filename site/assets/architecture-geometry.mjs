// Route orthogonal diagram edges around node boxes, keeping labels out of the boxes too.
export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 66;
export const COLUMN_GAP = 42;
export const ROW_GAP = 80;

export function layoutNodes(nodes) {
  return nodes.map(node => ({ ...node, x: 24 + node.col * (NODE_WIDTH + COLUMN_GAP), y: 94 + node.row * (NODE_HEIGHT + ROW_GAP), width: NODE_WIDTH, height: NODE_HEIGHT }));
}

export function diagramSize(nodes) {
  return { width: Math.max(...nodes.map(node => node.x + node.width)) + 24, height: Math.max(...nodes.map(node => node.y + node.height)) + 66 };
}

function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function segmentHitsBox(a, b, box) {
  if (a.x === b.x) return a.x > box.x && a.x < box.x + box.width && Math.max(a.y, b.y) > box.y && Math.min(a.y, b.y) < box.y + box.height;
  if (a.y === b.y) return a.y > box.y && a.y < box.y + box.height && Math.max(a.x, b.x) > box.x && Math.min(a.x, b.x) < box.x + box.width;
  throw new Error('Diagram edges must be orthogonal');
}

function ports(node) {
  return [0.5, 0.25, 0.75].flatMap(fraction => [
    { x: node.x + node.width * fraction, y: node.y, dx: 0, dy: -1 },
    { x: node.x + node.width * fraction, y: node.y + node.height, dx: 0, dy: 1 },
    { x: node.x, y: node.y + node.height * fraction, dx: -1, dy: 0 },
    { x: node.x + node.width, y: node.y + node.height * fraction, dx: 1, dy: 0 },
  ]);
}

/** Choose the shortest clear route with a readable horizontal label, or use a numbered key. */
export function routeEdge(edge, nodes, occupiedLabels = [], occupiedSegments = []) {
  const from = nodes.find(node => node.id === edge.from);
  const to = nodes.find(node => node.id === edge.to);
  if (!from || !to) throw new Error(`Missing node for edge ${edge.id}`);
  const size = diagramSize(nodes);
  const xs = [...new Set([10, size.width - 10, ...nodes.flatMap(node => [node.x - COLUMN_GAP / 2, node.x + node.width + COLUMN_GAP / 2])])];
  const ys = [...new Set([54, size.height - 24, ...nodes.flatMap(node => [node.y - ROW_GAP / 2, node.y + node.height + ROW_GAP / 2])])];
  const labelWidth = [...edge.label].reduce((width, char) => width + (char.codePointAt(0) > 255 ? 14 : 7.5), 12);
  let best;
  for (const start of ports(from)) for (const end of ports(to)) {
    const candidates = [
      [start, { x: end.x, y: start.y }, end],
      [start, { x: start.x, y: end.y }, end],
      ...xs.map(x => [start, { x, y: start.y }, { x, y: end.y }, end]),
      ...ys.map(y => [start, { x: start.x, y }, { x: end.x, y }, end]),
    ];
    for (const candidate of candidates) {
      const points = candidate.filter((point, index) => index === 0 || point.x !== candidate[index - 1].x || point.y !== candidate[index - 1].y);
      if (points.length < 2) continue;
      const first = points[1], last = points.at(-2);
      if ((first.x - start.x) * start.dx + (first.y - start.y) * start.dy <= 0) continue;
      if ((last.x - end.x) * end.dx + (last.y - end.y) * end.dy <= 0) continue;
      if (points.some(point => point.x < 0 || point.y < 0 || point.x > size.width || point.y > size.height)) continue;
      const segments = points.slice(1).map((point, index) => [points[index], point]);
      if (segments.some(([a, b]) => nodes.some(node => segmentHitsBox(a, b, node)))) continue;
      let label;
      for (const [a, b] of segments) {
        if (a.y !== b.y || Math.abs(a.x - b.x) < labelWidth + 12) continue;
        const box = { x: (a.x + b.x - labelWidth) / 2, y: a.y - 20, width: labelWidth, height: 19 };
        if (box.y < 4 || [...nodes, ...occupiedLabels].some(other => intersects(box, other)) || occupiedSegments.some(([a, b]) => segmentHitsBox(a, b, box))) continue;
        label = box; break;
      }
      const length = segments.reduce((sum, [a, b]) => sum + Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 0);
      // Shared line segments look like a junction even when the edges are unrelated.
      let overlap = 0;
      for (const [a, b] of segments) for (const [c, d] of occupiedSegments) {
        if (a.x === b.x && c.x === d.x && a.x === c.x) overlap += Math.max(0, Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)));
        if (a.y === b.y && c.y === d.y && a.y === c.y) overlap += Math.max(0, Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)));
      }
      const score = length + points.length * 18 + overlap * 100 + (label ? 0 : 1500);
      if (!best || score < best.score) best = { points, label, score };
    }
  }
  if (!best) throw new Error(`Cannot route edge ${edge.id}`);
  return best;
}

/** Route every edge first; use a numbered key where any arrow would cross its label. */
export function routeDiagram(nodes, edges) {
  const labels = [];
  const segments = [];
  const routes = edges.map(edge => {
    const route = routeEdge(edge, nodes, labels, segments);
    if (route.label) labels.push(route.label);
    segments.push(...route.points.slice(1).map((point, index) => [route.points[index], point]));
    return route;
  });
  for (const route of routes) {
    if (route.label && segments.some(([a, b]) => segmentHitsBox(a, b, route.label))) route.label = undefined;
  }
  return routes;
}
