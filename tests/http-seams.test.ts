import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/analyses/route";
import { GET } from "../app/api/reports/[token]/route";

test("analysis API explains malformed JSON at the request seam", async () => {
  const response = await POST(new Request("http://localhost/api/analyses", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "tdd-invalid-json" }, body: "not-json" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Request body must be valid JSON" });
});

test("report API returns an overview and executable flow", async () => {
  const response = await GET(new Request("http://localhost/api/reports/demo"), { params: { token: "demo" } });
  const report = await response.json();
  assert.equal(response.status, 200);
  assert.equal(typeof report.overview.summary, "string");
  assert.ok(report.overview.flow.length >= 2);
  assert.ok(report.diagram.nodes.length >= 2);
  assert.ok(report.overview.flow.every((step: { modulePaths: string[] }) => step.modulePaths.every((path) => report.modules.some((module: { path: string }) => module.path === path))));
});
