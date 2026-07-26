import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProjectOverviewCandidate } from "../lib/llm-normalization";
import { projectOverviewSchema } from "../lib/validation";

test("normalizes overproduced Big Picture arrays and string evidence lines", () => {
  const candidate = {
    summary: "A project summary.",
    problem: "People need a clearer way to solve a recurring problem.",
    outcome: "Users get a useful result.",
    audience: ["one", "two", "three", "four", "five", "six"],
    capabilities: ["one", "two", "three", "four", "five", "six", "seven"],
    flow: [
      { title: "Start", description: "The user starts." },
      { title: "Finish", description: "The user finishes." },
      { title: "Extra", description: "This is ignored." }
    ],
    evidence: Array.from({ length: 9 }, (_, index) => ({
      filePath: "README.md",
      startLine: index === 0 ? "1" : "number",
      endLine: index === 0 ? "2" : "number",
      reason: "Supports the project explanation."
    }))
  };

  const parsed = projectOverviewSchema.parse(normalizeProjectOverviewCandidate(candidate));
  assert.equal(parsed.capabilities.length, 6);
  assert.equal(parsed.flow.length, 3);
  assert.deepEqual(parsed.evidence, [{
    filePath: "README.md",
    startLine: 1,
    endLine: 2,
    reason: "Supports the project explanation."
  }]);
});

