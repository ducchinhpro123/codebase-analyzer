export type GraphLayoutInputNode = { path: string };
export type GraphLayoutConnection = { source: string; target: string };
export type GraphLayoutNode = GraphLayoutInputNode & { x: number; y: number; width: number; height: number; column: number; row: number };
export type GraphLayout = { width: number; height: number; nodes: GraphLayoutNode[] };
export type GraphEdgeRoute = { path: string };
export const GRAPH_EDGE_COLOR_COUNT = 8;

export function graphEdgeColorIndex(sourcePath: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < sourcePath.length; index += 1) {
    hash ^= sourcePath.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % GRAPH_EDGE_COLOR_COUNT;
}

function sortByOriginalOrder(paths: string[], originalOrder: Map<string, number>) {
  return [...paths].sort((a, b) => (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0));
}

/**
 * A compact Sugiyama-style layout: dependency depth chooses a column, then
 * barycenter sweeps reorder each column to reduce crossings. It is fully
 * deterministic, so the same report has the same map before a user drags a
 * node.
 */
export function buildGraphLayout(input: {
  nodes: GraphLayoutInputNode[];
  connections: GraphLayoutConnection[];
  compact?: boolean;
}): GraphLayout {
  const compact = Boolean(input.compact);
  const columns = compact ? 2 : 4;
  const nodeWidth = compact ? 150 : 178;
  const nodeHeight = compact ? 52 : 70;
  const columnGap = compact ? 64 : 58;
  const rowGap = compact ? 38 : 42;
  const paddingX = compact ? 56 : 38;
  const paddingY = compact ? 40 : 44;
  const originalOrder = new Map(input.nodes.map((node, index) => [node.path, index]));
  const known = new Set(input.nodes.map((node) => node.path));
  const outgoing = new Map(input.nodes.map((node) => [node.path, new Set<string>()]));
  const incoming = new Map(input.nodes.map((node) => [node.path, new Set<string>()]));

  for (const connection of input.connections) {
    if (!known.has(connection.source) || !known.has(connection.target) || connection.source === connection.target) continue;
    outgoing.get(connection.source)!.add(connection.target);
    incoming.get(connection.target)!.add(connection.source);
  }

  const indegree = new Map(input.nodes.map((node) => [node.path, incoming.get(node.path)!.size]));
  const levels = new Map(input.nodes.map((node) => [node.path, 0]));
  const queue = input.nodes.filter((node) => indegree.get(node.path) === 0).map((node) => node.path);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const source = queue[cursor];
    for (const target of outgoing.get(source) ?? []) {
      levels.set(target, Math.max(levels.get(target) ?? 0, (levels.get(source) ?? 0) + 1));
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }

  const maxLevel = Math.max(0, ...levels.values());
  const columnFor = (path: string) => {
    const degree = (incoming.get(path)?.size ?? 0) + (outgoing.get(path)?.size ?? 0);
    if (degree === 0) return (originalOrder.get(path) ?? 0) % columns;
    if (maxLevel <= columns - 1) return Math.min(columns - 1, levels.get(path) ?? 0);
    return Math.min(columns - 1, Math.floor(((levels.get(path) ?? 0) * (columns - 1)) / maxLevel));
  };

  const columnsByNode = new Map(input.nodes.map((node) => [node.path, columnFor(node.path)]));
  const grouped = Array.from({ length: columns }, () => [] as string[]);
  for (const node of input.nodes) grouped[columnsByNode.get(node.path) ?? 0].push(node.path);
  for (const group of grouped) group.splice(0, group.length, ...sortByOriginalOrder(group, originalOrder));

  const neighborScore = (path: string, column: number, direction: "incoming" | "outgoing") => {
    const neighbors = direction === "incoming" ? incoming.get(path) : outgoing.get(path);
    const relevant = [...(neighbors ?? [])].filter((neighbor) => columnsByNode.get(neighbor) !== column);
    if (!relevant.length) return Number.POSITIVE_INFINITY;
    const indexes = relevant.map((neighbor) => grouped[columnsByNode.get(neighbor) ?? 0].indexOf(neighbor)).filter((index) => index >= 0);
    return indexes.length ? indexes.reduce((sum, index) => sum + index, 0) / indexes.length : Number.POSITIVE_INFINITY;
  };

  for (let pass = 0; pass < 4; pass += 1) {
    for (let column = 1; column < columns; column += 1) {
      const current = grouped[column];
      current.sort((a, b) => {
        const scoreDelta = neighborScore(a, column, "incoming") - neighborScore(b, column, "incoming");
        return (Number.isFinite(scoreDelta) ? scoreDelta : 0) || (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0);
      });
    }
    for (let column = columns - 2; column >= 0; column -= 1) {
      const current = grouped[column];
      current.sort((a, b) => {
        const scoreDelta = neighborScore(a, column, "outgoing") - neighborScore(b, column, "outgoing");
        return (Number.isFinite(scoreDelta) ? scoreDelta : 0) || (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0);
      });
    }
  }

  const nodes = grouped.flatMap((group, column) => group.map((path, row) => ({
    path,
    column,
    row,
    x: paddingX + column * (nodeWidth + columnGap),
    y: paddingY + row * (nodeHeight + rowGap),
    width: nodeWidth,
    height: nodeHeight
  })));
  const rows = Math.max(1, ...grouped.map((group) => group.length));
  return {
    width: paddingX * 2 + columns * nodeWidth + (columns - 1) * columnGap,
    height: paddingY * 2 + rows * nodeHeight + (rows - 1) * rowGap,
    nodes
  };
}

function laneOffset(index: number) {
  return ((index % 5) - 2) * 7;
}

export function routeGraphEdge(source: GraphLayoutNode, target: GraphLayoutNode, index: number, width: number): GraphEdgeRoute {
  const offset = laneOffset(index);
  const sourceCenterX = source.x + source.width / 2;
  const targetCenterX = target.x + target.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterY = target.y + target.height / 2;
  const targetIsRight = target.x >= source.x + source.width;
  const targetIsLeft = source.x >= target.x + target.width;
  const targetIsBelow = target.y >= source.y + source.height;
  const targetIsAbove = source.y >= target.y + target.height;

  // When the rectangles are horizontally separate, attach to their facing
  // sides. This uses live coordinates, so dragging either card immediately
  // moves the endpoint without relying on its original grid row.
  if (targetIsRight || targetIsLeft) {
    const leftToRight = targetIsRight;
    const startX = leftToRight ? source.x + source.width : source.x;
    const endX = leftToRight ? target.x : target.x + target.width;
    if (Math.abs(sourceCenterY - targetCenterY) < 2) return { path: `M ${startX} ${sourceCenterY} H ${endX}` };
    const laneX = (startX + endX) / 2 + offset;
    return { path: `M ${startX} ${sourceCenterY} H ${laneX} V ${targetCenterY} H ${endX}` };
  }

  // Vertically separate rectangles connect through the horizontal gap.
  if (targetIsBelow || targetIsAbove) {
    const topToBottom = targetIsBelow;
    const startY = topToBottom ? source.y + source.height : source.y;
    const endY = topToBottom ? target.y : target.y + target.height;
    if (Math.abs(sourceCenterX - targetCenterX) < 2) return { path: `M ${sourceCenterX} ${startY} V ${endY}` };
    const laneY = (startY + endY) / 2 + offset;
    return { path: `M ${sourceCenterX} ${startY} V ${laneY} H ${targetCenterX} V ${endY}` };
  }

  // If the user overlaps cards, route around their outside edge until they
  // are separated again.
  const routeRight = targetCenterX >= sourceCenterX;
  const startX = routeRight ? source.x + source.width : source.x;
  const endX = routeRight ? target.x + target.width : target.x;
  const railX = routeRight
    ? Math.min(width - 12, Math.max(startX, endX) + 24 + Math.abs(offset))
    : Math.max(12, Math.min(startX, endX) - 24 - Math.abs(offset));
  return { path: `M ${startX} ${sourceCenterY} H ${railX} V ${targetCenterY} H ${endX}` };
}
