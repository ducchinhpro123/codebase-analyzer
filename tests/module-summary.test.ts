import assert from "node:assert/strict";
import test from "node:test";
import { buildDeterministicModuleSummary } from "../lib/module-summary";

const metric = { complexity: 4, lines: 42, fanIn: 2, fanOut: 3, hotspotScore: 30 };

test("the deterministic explanation reports the modules it actually imports", () => {
  const summary = buildDeterministicModuleSummary(
    { path: "lib/store.ts", language: "typescript", source: "import a from './a';\nexport function save() {}\n", lines: 42 },
    metric,
    ["lib/a.ts", "lib/b.ts"]
  );

  assert.match(summary.responsibilities.join(" "), /Coordinates 2 imported modules/);
  assert.deepEqual(summary.dependencies, ["lib/a.ts", "lib/b.ts"]);
  assert.equal(summary.generatedBy, "deterministic-fallback");
  assert.equal(summary.confidence, "low");
});

test("a leaf module is described as having no local imports", () => {
  const summary = buildDeterministicModuleSummary(
    { path: "lib/leaf.ts", language: "typescript", source: "export const value = 1;\n", lines: 1 },
    metric,
    []
  );

  assert.match(summary.responsibilities.join(" "), /leaf implementation with no local imports/);
});

test("the explanation anchors evidence inside the module's own line range", () => {
  const summary = buildDeterministicModuleSummary(
    { path: "lib/short.ts", language: "typescript", source: "const x = 1;\nexport function run() {}\n", lines: 2 },
    { ...metric, lines: 2 },
    []
  );

  const [anchor] = summary.evidence ?? [];
  assert.equal(anchor.filePath, "lib/short.ts");
  assert.ok(anchor.startLine >= 1);
  assert.ok(anchor.endLine <= 2, `evidence must not run past the file, got ${anchor.endLine}`);
});

test("a hotspot carries a review risk that a quiet module does not", () => {
  const file = { path: "lib/hot.ts", language: "typescript", source: "export function run() {}\n", lines: 10 };

  const hot = buildDeterministicModuleSummary(file, { ...metric, hotspotScore: 88 }, []);
  const quiet = buildDeterministicModuleSummary(file, { ...metric, hotspotScore: 12 }, []);

  assert.equal(hot.risks.length, 1);
  assert.deepEqual(quiet.risks, []);
});
