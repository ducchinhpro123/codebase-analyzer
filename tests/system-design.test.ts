import assert from "node:assert/strict";
import test from "node:test";
import { demoReport } from "../lib/demo";
import { diagramToDrawio, diagramToSvg } from "../lib/diagram-export";
import { buildFallbackSystemDesign, normalizeSystemDesign, systemDesignToDiagram, systemDesignToMermaid } from "../lib/system-design";
import { repositorySystemDesignSchema } from "../lib/validation";
import type { AnalyzedModule } from "../lib/types";

function module(path: string, cluster: string, fanOut: number, purpose: string): AnalyzedModule {
  return {
    id: path,
    path,
    language: "typescript",
    cluster,
    metric: { complexity: 2, lines: 40, fanIn: 1, fanOut, hotspotScore: 20 },
    summary: {
      modulePath: path,
      purpose,
      responsibilities: ["Coordinates one architecture area"],
      keyFlows: ["Input → output"],
      dependencies: [],
      risks: [],
      confidence: "high",
      generatedBy: "deterministic-fallback",
      evidence: [{ filePath: path, startLine: 1, endLine: 12, reason: "Module evidence" }]
    }
  };
}

test("builds an evidence-backed C4 container fallback from source and Compose context", () => {
  const modules = [
    module("app/api/route.ts", "app", 3, "HTTP entrypoint for repository requests."),
    module("worker/index.ts", "worker", 2, "Runs background analysis jobs."),
    module("lib/store.ts", "store", 0, "Persists completed reports.")
  ];
  const design = buildFallbackSystemDesign({
    repositoryName: "example/repository",
    modules,
    edges: [
      { source: "app/api/route.ts", target: "worker/index.ts", kind: "import" },
      { source: "worker/index.ts", target: "lib/store.ts", kind: "import" },
      { source: "worker/index.ts", target: "redis", kind: "unresolved" }
    ],
    contextFiles: [{ path: "docker-compose.yml", source: "services:\n  redis:\n    image: redis:7\n", lines: 4 }]
  });

  assert.equal(repositorySystemDesignSchema.safeParse(design).success, true);
  assert.ok(design.boundaries.some((boundary) => boundary.kind === "system"));
  assert.ok(design.nodes.some((node) => node.kind === "worker"));
  assert.ok(design.nodes.some((node) => node.kind === "store"));
  assert.ok(design.nodes.some((node) => node.label === "redis"));
  assert.ok(design.relationships.every((relationship) => design.nodes.some((node) => node.id === relationship.source) && design.nodes.some((node) => node.id === relationship.target)));
});

test("does not promote every root-level source file into a C4 container", () => {
  const modules = [
    module("web.py", "root", 3, "Small web adapter that exposes an HTTP API."),
    module("main.py", "root", 2, "Entry point for the CLI tool."),
    module("cli.py", "root", 2, "Command-line interface for translation."),
    module("pipeline.py", "root", 3, "Coordinates batching and annotation validation."),
    module("llm.py", "root", 1, "Provides structured LLM parsing."),
    module("llm_setup.py", "root", 1, "Configures model provider settings."),
    module("srt.py", "root", 0, "Parses and writes subtitle documents."),
    module("__init__.py", "root", 0, "Initializes the package.")
  ];
  const design = buildFallbackSystemDesign({
    repositoryName: "example/translator",
    modules,
    edges: [
      { source: "web.py", target: "pipeline.py", kind: "from" },
      { source: "main.py", target: "cli.py", kind: "from" },
      { source: "cli.py", target: "pipeline.py", kind: "from" },
      { source: "pipeline.py", target: "llm.py", kind: "from" }
    ]
  });
  const internalNodes = design.nodes.filter((node) => node.boundaryId === "system");

  assert.ok(internalNodes.length <= 3, `expected at most 3 logical containers, received ${internalNodes.length}`);
  assert.ok(internalNodes.every((node) => !/\.(?:py|tsx?|jsx?)$/i.test(node.label)), "container labels must describe system roles, not filenames");
});

test("normalizes inferred system-design claims and preserves exportability", () => {
  const design = buildFallbackSystemDesign({ repositoryName: demoReport.repositoryName, modules: demoReport.modules, edges: demoReport.edges });
  const normalized = normalizeSystemDesign(
    {
      ...design,
      nodes: [...design.nodes, { ...design.nodes[0], id: "bad", modulePaths: ["missing.ts"], evidence: [{ filePath: "missing.ts", startLine: 1, endLine: 3, reason: "invalid" }], provenance: "observed" }],
      relationships: [...design.relationships, { ...design.relationships[0], id: "bad-edge", source: "bad", target: "bad" }]
    },
    new Set(demoReport.modules.map((item) => item.path)),
    new Map(demoReport.modules.flatMap((item) => item.summary.evidence?.map((evidence) => [evidence.filePath, 200] as const) ?? []))
  );
  const diagram = systemDesignToDiagram(normalized);

  assert.ok(!normalized.nodes.some((node) => node.id === "bad"));
  assert.ok(normalized.relationships.every((relationship) => relationship.source !== relationship.target));
  assert.match(diagramToSvg(diagram, { ariaLabel: "System design architecture diagram" }), /System design architecture diagram/);
  assert.match(diagramToDrawio(diagram, { name: "System design architecture" }), /System design architecture/);
});

test("projects the system-design model into a Mermaid flowchart with boundaries", () => {
  const design = demoReport.systemDesign!;
  const source = systemDesignToMermaid(design);

  assert.match(source, /^flowchart LR/);
  assert.match(source, /subgraph .+\["Tracepath"\]/);
  assert.match(source, /classDef container fill:#f1f3ef,stroke:#14505c/);
  assert.match(source, /enqueues analysis/);
  assert.doesNotMatch(source, /app\/page\.tsx/);
});
