import { layoutDiagram, routeDiagramEdge, shouldRenderDiagramEdgeLabel } from "./diagram-layout";
import type { DiagramNodeKind, RepositoryDiagram } from "./types";

const colors: Record<DiagramNodeKind, { fill: string; stroke: string; label: string }> = {
  actor: { fill: "#f9e8e3", stroke: "#c43f2a", label: "ACTOR" },
  service: { fill: "#f3f5f7", stroke: "#7b848c", label: "SERVICE" },
  container: { fill: "#f3f5f7", stroke: "#67727a", label: "CONTAINER" },
  worker: { fill: "#eef1f3", stroke: "#606a73", label: "WORKER" },
  store: { fill: "#e9eef0", stroke: "#4d6772", label: "STORE" },
  queue: { fill: "#edf0f7", stroke: "#58658a", label: "QUEUE" },
  artifact: { fill: "#f4f0e9", stroke: "#87745e", label: "ARTIFACT" },
  transform: { fill: "#f5ede8", stroke: "#aa604b", label: "TRANSFORM" },
  boundary: { fill: "#eef0f2", stroke: "#8a9299", label: "BOUNDARY" },
  "external-system": { fill: "#f7efe8", stroke: "#9a6948", label: "EXTERNAL" }
};

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function line(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function wrapText(value: string, maxChars: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current ? `${current} ${word}` : word).length > maxChars && current) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines.slice(0, 2).map((item, index, all) => index === all.length - 1 && lines.length > 2 ? `${item.slice(0, Math.max(1, maxChars - 3))}...` : item);
}

export function diagramToSvg(diagram: RepositoryDiagram, options: { ariaLabel?: string } = {}) {
  const layout = layoutDiagram(diagram);
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  const edges = layout.relationships.map((relationship) => {
    const source = nodeMap.get(relationship.source);
    const target = nodeMap.get(relationship.target);
    if (!source || !target) return "";
    const relationshipIndex = layout.relationships.indexOf(relationship);
    const route = routeDiagramEdge(source, target, relationshipIndex, layout.nodes, layout.width);
    const label = shouldRenderDiagramEdgeLabel(relationship) ? `<text x="${route.labelX}" y="${route.labelY}" text-anchor="middle" fill="#5d656c" stroke="#fafbfc" stroke-width="5" paint-order="stroke" font-family="monospace" font-size="11">${escapeXml(line(relationship.label, 28))}</text>` : "";
    return `<path d="${route.path}" fill="none" stroke="#8e9aa2" stroke-width="1.5" marker-end="url(#arrow)"/>${label}`;
  }).join("");
  const nodes = layout.nodes.map((node) => {
    const color = colors[node.kind];
    const description = wrapText(node.description, 34).map((item, index) => `<tspan x="${node.x + 16}" dy="${index ? 14 : 0}">${escapeXml(item)}</tspan>`).join("");
    return `<g><rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="10" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2"/><text x="${node.x + 16}" y="${node.y + 23}" fill="${color.stroke}" font-family="monospace" font-size="10" font-weight="700">${color.label}</text><text x="${node.x + 16}" y="${node.y + 50}" fill="#171a1c" font-family="Arial,sans-serif" font-size="17" font-weight="600">${escapeXml(line(node.label, 24))}</text><text x="${node.x + 16}" y="${node.y + 73}" fill="#5d656c" font-family="Arial,sans-serif" font-size="11">${description}</text><text x="${node.x + 16}" y="${node.y + 99}" fill="#7b848c" font-family="monospace" font-size="9">${node.provenance === "observed" ? "OBSERVED" : "INFERRED"} / ${node.modulePaths.length} modules</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeXml(options.ariaLabel ?? "Data-flow architecture diagram")}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#8e9aa2"/></marker></defs><rect width="100%" height="100%" fill="#fafbfc"/>${edges}${nodes}</svg>`;
}

export function diagramToDrawio(diagram: RepositoryDiagram, options: { name?: string } = {}) {
  const layout = layoutDiagram(diagram);
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  const cells = layout.nodes.map((node) => {
    const color = colors[node.kind];
    const value = `${node.label}\n${node.provenance === "observed" ? "Observed" : "Inferred"}`;
    return `<mxCell id="${escapeXml(node.id)}" value="${escapeXml(value)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${color.fill};strokeColor=${color.stroke};fontColor=#171a1c;" vertex="1" parent="1"><mxGeometry x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" as="geometry"/></mxCell>`;
  }).join("");
  const edges = layout.relationships.map((relationship) => {
    if (!nodeMap.has(relationship.source) || !nodeMap.has(relationship.target)) return "";
    return `<mxCell id="edge-${escapeXml(relationship.id)}" value="${escapeXml(shouldRenderDiagramEdgeLabel(relationship) ? relationship.label : "")}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="${escapeXml(relationship.source)}" target="${escapeXml(relationship.target)}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><mxfile host="tracepath"><diagram name="${escapeXml(options.name ?? "Repository overview")}"><mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}${edges}</root></mxGraphModel></diagram></mxfile>`;
}
