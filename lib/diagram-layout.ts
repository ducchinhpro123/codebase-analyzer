import type { DiagramNode, DiagramRelationship, RepositoryDiagram } from "./types";

export type DiagramLayoutNode = DiagramNode & { x: number; y: number; width: number; height: number };
export type DiagramLayout = { width: number; height: number; nodes: DiagramLayoutNode[]; relationships: DiagramRelationship[] };
export type DiagramEdgeRoute = { path: string; labelX: number; labelY: number };

function orderNodes(nodes: DiagramNode[], relationships: DiagramRelationship[]) {
  const originalOrder = new Map(nodes.map((node, index) => [node.id, index]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, new Set<string>()]));

  for (const relationship of relationships) {
    if (!indegree.has(relationship.source) || !indegree.has(relationship.target) || relationship.source === relationship.target) continue;
    const targets = outgoing.get(relationship.source)!;
    if (targets.has(relationship.target)) continue;
    targets.add(relationship.target);
    indegree.set(relationship.target, (indegree.get(relationship.target) ?? 0) + 1);
  }

  const available = nodes.filter((node) => indegree.get(node.id) === 0);
  const ordered: DiagramNode[] = [];
  while (available.length) {
    available.sort((a, b) => {
      const fanOutDelta = (outgoing.get(b.id)?.size ?? 0) - (outgoing.get(a.id)?.size ?? 0);
      return fanOutDelta || (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
    });
    const node = available.shift()!;
    ordered.push(node);
    for (const target of outgoing.get(node.id) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) available.push(nodes.find((candidate) => candidate.id === target)!);
    }
  }

  // Cycles are valid in real repositories. Keep any cyclic remainder stable
  // instead of dropping it or producing a non-deterministic layout.
  if (ordered.length < nodes.length) {
    const included = new Set(ordered.map((node) => node.id));
    ordered.push(...nodes.filter((node) => !included.has(node.id)));
  }
  return ordered;
}

export function layoutDiagram(diagram: RepositoryDiagram): DiagramLayout {
  const nodeWidth = 224;
  const nodeHeight = 118;
  const gapX = 72;
  const gapY = 42;
  const padding = 44;
  const columns = Math.min(4, Math.max(2, diagram.nodes.length));
  const rows = Math.max(1, Math.ceil(diagram.nodes.length / columns));
  const width = padding * 2 + columns * nodeWidth + (columns - 1) * gapX;
  const height = padding * 2 + rows * nodeHeight + (rows - 1) * gapY;
  const nodes = orderNodes(diagram.nodes, diagram.relationships).map((node, index) => ({
    ...node,
    x: padding + (index % columns) * (nodeWidth + gapX),
    y: padding + Math.floor(index / columns) * (nodeHeight + gapY),
    width: nodeWidth,
    height: nodeHeight
  }));
  return { width, height, nodes, relationships: diagram.relationships };
}

function laneOffset(index: number) {
  return ((index % 5) - 2) * 7;
}

function nodeRow(node: DiagramLayoutNode, nodes: DiagramLayoutNode[]) {
  return [...new Set(nodes.map((item) => item.y).sort((a, b) => a - b))].indexOf(node.y);
}

function nodeColumn(node: DiagramLayoutNode, nodes: DiagramLayoutNode[]) {
  return [...new Set(nodes.map((item) => item.x).sort((a, b) => a - b))].indexOf(node.x);
}

/**
 * Routes edges through the gaps between cards. Direct curves look elegant for
 * one edge, but become unreadable as soon as a repository has fan-in or
 * fan-out. These orthogonal rails keep connectors out of card content and
 * give labels a stable place to sit.
 */
export function routeDiagramEdge(
  source: DiagramLayoutNode,
  target: DiagramLayoutNode,
  index: number,
  nodes: DiagramLayoutNode[],
  width: number
): DiagramEdgeRoute {
  const sourceRow = nodeRow(source, nodes);
  const targetRow = nodeRow(target, nodes);
  const sourceColumn = nodeColumn(source, nodes);
  const targetColumn = nodeColumn(target, nodes);
  const offset = laneOffset(index);
  const sourceCenterX = source.x + source.width / 2;
  const targetCenterX = target.x + target.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterY = target.y + target.height / 2;

  if (sourceRow === targetRow && Math.abs(sourceColumn - targetColumn) === 1) {
    const leftToRight = target.x > source.x;
    const startX = leftToRight ? source.x + source.width : source.x;
    const endX = leftToRight ? target.x : target.x + target.width;
    const y = sourceCenterY;
    return { path: `M ${startX} ${y} H ${endX}`, labelX: (startX + endX) / 2, labelY: y - 9 };
  }

  if (sourceRow === targetRow) {
    const leftToRight = target.x > source.x;
    const startX = leftToRight ? source.x + source.width : source.x;
    const endX = leftToRight ? target.x : target.x + target.width;
    const laneY = Math.max(16, source.y - 18 + offset);
    return {
      path: `M ${startX} ${sourceCenterY} V ${laneY} H ${endX} V ${targetCenterY}`,
      labelX: (startX + endX) / 2,
      labelY: laneY - 7
    };
  }

  if (targetRow > sourceRow && targetRow - sourceRow === 1) {
    const laneY = (source.y + source.height + target.y) / 2 + offset;
    return {
      path: `M ${sourceCenterX} ${source.y + source.height} V ${laneY} H ${targetCenterX} V ${target.y}`,
      labelX: (sourceCenterX + targetCenterX) / 2,
      labelY: laneY - 7
    };
  }

  if (sourceRow > targetRow && sourceRow - targetRow === 1) {
    const laneY = (target.y + target.height + source.y) / 2 + offset;
    return {
      path: `M ${sourceCenterX} ${source.y} V ${laneY} H ${targetCenterX} V ${target.y + target.height}`,
      labelX: (sourceCenterX + targetCenterX) / 2,
      labelY: laneY - 7
    };
  }

  const routeRight = target.x >= source.x;
  const railX = routeRight ? width - 20 : 20;
  if (targetRow > sourceRow) {
    const startY = source.y + source.height + 16 + offset;
    const endY = target.y - 16 + offset;
    return {
      path: `M ${sourceCenterX} ${source.y + source.height} V ${startY} H ${railX} V ${endY} H ${targetCenterX} V ${target.y}`,
      labelX: railX + (routeRight ? -8 : 8),
      labelY: (startY + endY) / 2
    };
  }

  const startY = source.y - 16 + offset;
  const endY = target.y + target.height + 16 + offset;
  return {
    path: `M ${sourceCenterX} ${source.y} V ${startY} H ${railX} V ${endY} H ${targetCenterX} V ${target.y + target.height}`,
    labelX: railX + (routeRight ? -8 : 8),
    labelY: (startY + endY) / 2
  };
}

export function shouldRenderDiagramEdgeLabel(relationship: DiagramRelationship) {
  return relationship.kind !== "depends-on" && Boolean(relationship.label.trim());
}
