import assert from "node:assert/strict";
import test from "node:test";
import { buildGraphCoverage, describeGraphCoverage } from "../lib/graph-coverage";
import type { DependencyEdge } from "../lib/types";

const edge = (kind: DependencyEdge["kind"]): DependencyEdge => ({ source: "a", target: "b", kind });

test("coverage reports how much of the repository could contribute imports", () => {
  const coverage = buildGraphCoverage(
    [{ language: "go" }, { language: "go" }, { language: "yaml" }, { language: "json" }],
    []
  );

  assert.equal(coverage.filesRead, 4);
  assert.equal(coverage.filesWithImportSupport, 2);
  assert.deepEqual(coverage.languagesWithImportSupport, ["go"]);
  assert.deepEqual(coverage.languagesWithoutImportSupport, ["json", "yaml"]);
});

test("coverage separates edges that landed on a module from those that did not", () => {
  const coverage = buildGraphCoverage(
    [{ language: "typescript" }],
    [edge("import"), edge("import"), edge("unresolved"), edge("require")]
  );

  assert.equal(coverage.resolvedEdges, 3);
  assert.equal(coverage.unresolvedEdges, 1);
});

test("a repository written entirely in unreadable languages is reported as such", () => {
  const coverage = buildGraphCoverage([{ language: "cobol" }, { language: "vhdl" }], []);

  assert.equal(coverage.filesWithImportSupport, 0);
  assert.deepEqual(coverage.languagesWithImportSupport, []);
  assert.deepEqual(coverage.languagesWithoutImportSupport, ["cobol", "vhdl"]);
});

test("an empty repository does not report false coverage", () => {
  const coverage = buildGraphCoverage([], []);

  assert.equal(coverage.filesRead, 0);
  assert.equal(coverage.filesWithImportSupport, 0);
  assert.equal(coverage.resolvedEdges, 0);
  assert.equal(coverage.unresolvedEdges, 0);
});

test("a repository whose imports were all readable says nothing about coverage", () => {
  const full = buildGraphCoverage([{ language: "go" }, { language: "go" }], []);

  assert.equal(describeGraphCoverage(full), undefined);
  assert.equal(describeGraphCoverage(undefined), undefined);
});

test("a partially readable repository reports the share and the missing languages", () => {
  const coverage = buildGraphCoverage(
    [{ language: "go" }, { language: "go" }, { language: "go" }, { language: "yaml" }],
    []
  );

  assert.deepEqual(describeGraphCoverage(coverage), {
    filesRead: 4,
    filesWithImportSupport: 3,
    unreadFiles: 1,
    sharePercent: 75,
    languages: ["yaml"]
  });
});

test("a repository with no files at all reports no coverage note", () => {
  assert.equal(describeGraphCoverage(buildGraphCoverage([], [])), undefined);
});

test("the share is rounded rather than truncated toward a misleading number", () => {
  const coverage = buildGraphCoverage(
    [...Array(2).fill({ language: "go" }), { language: "yaml" }],
    []
  );

  assert.equal(describeGraphCoverage(coverage)?.sharePercent, 67);
});
