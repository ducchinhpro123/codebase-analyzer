import assert from "node:assert/strict";
import test from "node:test";
import { mapWithConcurrency } from "../lib/concurrency";

test("mapWithConcurrency caps in-flight work and preserves item order", async () => {
  let active = 0;
  let maxActive = 0;

  const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return item * 2;
  });

  assert.ok(maxActive > 1);
  assert.ok(maxActive <= 3);
  assert.deepEqual(results, [2, 4, 6, 8, 10, 12, 14]);
});
