import assert from "node:assert/strict";
import test from "node:test";
import { buildGraphLayout, GRAPH_EDGE_COLOR_COUNT, graphEdgeColorIndex, routeGraphEdge } from "../lib/graph-layout";

test("graph layout assigns dependency depth to columns without node overlap", () => {
  const layout = buildGraphLayout({
    nodes: [{ path: "entry" }, { path: "service" }, { path: "store" }, { path: "worker" }],
    connections: [
      { source: "entry", target: "service" },
      { source: "worker", target: "service" },
      { source: "service", target: "store" }
    ]
  });
  const positions = new Map(layout.nodes.map((node) => [node.path, node]));

  assert.ok(positions.get("entry")!.x < positions.get("service")!.x);
  assert.ok(positions.get("service")!.x < positions.get("store")!.x);
  assert.equal(new Set(layout.nodes.map((node) => `${node.x}:${node.y}`)).size, layout.nodes.length);
  assert.ok(layout.nodes.every((node) => node.x >= 0 && node.y >= 0));
});

test("compact graph uses denser cards with enough routing space", () => {
  const layout = buildGraphLayout({
    compact: true,
    nodes: [{ path: "entry" }, { path: "service" }, { path: "store" }],
    connections: [{ source: "entry", target: "service" }, { source: "service", target: "store" }]
  });

  assert.ok(layout.nodes.every((node) => node.width === 150 && node.height === 52));
  assert.ok(layout.nodes.every((node) => node.x >= 56 && node.y >= 40));
  assert.ok(layout.width > layout.nodes[0].width * 3);
});

test("graph edge routing uses rails instead of crossing node content", () => {
  const layout = buildGraphLayout({
    nodes: [{ path: "entry" }, { path: "service" }, { path: "store" }],
    connections: [{ source: "entry", target: "service" }, { source: "entry", target: "store" }]
  });
  const source = layout.nodes.find((node) => node.path === "entry")!;
  const target = layout.nodes.find((node) => node.path === "store")!;
  const route = routeGraphEdge(source, target, 0, layout.width);

  assert.match(route.path, /\sV\s/);
  assert.match(route.path, /\sH\s/);
});

test("graph edge endpoints follow a node after it is dragged away from its original row", () => {
  const layout = buildGraphLayout({
    nodes: [{ path: "entry" }, { path: "service" }],
    connections: [{ source: "entry", target: "service" }]
  });
  const source = layout.nodes.find((node) => node.path === "entry")!;
  const target = layout.nodes.find((node) => node.path === "service")!;
  const draggedTarget = { ...target, y: target.y + 170 };
  const route = routeGraphEdge(source, draggedTarget, 0, layout.width);
  const draggedCenterY = draggedTarget.y + draggedTarget.height / 2;

  assert.match(route.path, new RegExp(`V ${draggedCenterY}(?: |$)`));
  assert.match(route.path, new RegExp(`H ${draggedTarget.x}$`));
});

test("graph edge colors are stable per source module", () => {
  const first = graphEdgeColorIndex("lib/analyzer.ts");
  const repeated = graphEdgeColorIndex("lib/analyzer.ts");
  const samples = ["lib/analyzer.ts", "lib/store.ts", "app/page.tsx", "worker/index.ts"].map(graphEdgeColorIndex);

  assert.equal(first, repeated);
  assert.ok(first >= 0 && first < GRAPH_EDGE_COLOR_COUNT);
  assert.ok(new Set(samples).size > 1);
});
