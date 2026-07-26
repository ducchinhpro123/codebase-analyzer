import assert from "node:assert/strict";
import test from "node:test";
import { resolveSummaryBudget, selectModulesForLlmSummary } from "../lib/summary-budget";
import type { ModuleMetric } from "../lib/types";

function moduleAt(path: string, metric: Partial<ModuleMetric>) {
  return { path, metric: { complexity: 1, lines: 10, fanIn: 0, fanOut: 0, hotspotScore: 0, ...metric } };
}

test("every module is read by the model when the repository fits the budget", () => {
  const modules = [moduleAt("a.ts", {}), moduleAt("b.ts", {}), moduleAt("c.ts", {})];

  const selected = selectModulesForLlmSummary(modules, 10);

  assert.deepEqual([...selected].sort(), ["a.ts", "b.ts", "c.ts"]);
});

test("the budget keeps the most connected and complex modules", () => {
  const modules = [
    moduleAt("leaf.ts", { fanIn: 0, fanOut: 0, hotspotScore: 5 }),
    moduleAt("hub.ts", { fanIn: 12, fanOut: 3, hotspotScore: 80 }),
    moduleAt("busy.ts", { fanIn: 1, fanOut: 6, hotspotScore: 60 })
  ];

  const selected = selectModulesForLlmSummary(modules, 2);

  assert.equal(selected.size, 2);
  assert.ok(selected.has("hub.ts"));
  assert.ok(selected.has("busy.ts"));
  assert.ok(!selected.has("leaf.ts"));
});

test("modules with identical rank are chosen in a stable path order", () => {
  const tied = [moduleAt("z.ts", {}), moduleAt("m.ts", {}), moduleAt("a.ts", {})];

  const selected = selectModulesForLlmSummary(tied, 2);

  assert.deepEqual([...selected].sort(), ["a.ts", "m.ts"]);
});

test("a zero budget leaves every module to the deterministic explanation", () => {
  const selected = selectModulesForLlmSummary([moduleAt("a.ts", { fanIn: 9 })], 0);

  assert.equal(selected.size, 0);
});

test("the configured budget is read from the environment with a usable default", () => {
  assert.equal(resolveSummaryBudget(undefined), 120);
  assert.equal(resolveSummaryBudget("40"), 40);
  assert.equal(resolveSummaryBudget("not-a-number"), 120);
  assert.equal(resolveSummaryBudget("-5"), 0);
});
