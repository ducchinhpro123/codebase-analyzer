import assert from "node:assert/strict";
import test from "node:test";
import { GRAPH_DRAG_THRESHOLD, shouldStartGraphDrag } from "../lib/graph-interaction";

test("small pointer movement remains a module selection", () => {
  assert.equal(shouldStartGraphDrag(3, 4), false);
  assert.equal(shouldStartGraphDrag(GRAPH_DRAG_THRESHOLD - 0.01, 0), false);
});

test("movement at the drag threshold starts repositioning", () => {
  assert.equal(shouldStartGraphDrag(GRAPH_DRAG_THRESHOLD, 0), true);
  assert.equal(shouldStartGraphDrag(6, 6), true);
});
