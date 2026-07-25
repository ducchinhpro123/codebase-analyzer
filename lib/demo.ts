import type { AnalysisReport } from "./types";

export const demoReport: AnalysisReport = {
  id: "demo",
  shareToken: "demo",
  repositoryUrl: "https://github.com/tracepath/tracepath",
  repositoryName: "tracepath/tracepath",
  commitSha: "a81f3c2",
  branch: "main",
  analyzedAt: new Date().toISOString(),
  languages: ["typescript", "python"],
  totals: { files: 42, lines: 12840, modules: 18, edges: 31 },
  clusters: ["app", "analyzer", "worker", "shared"],
  overview: {
    summary: "Tracepath turns a public GitHub repository into an explorable architecture report. It clones a fixed snapshot, extracts a syntax-backed dependency graph, measures complexity and coupling, then asks DeepSeek to explain each module with source evidence.",
    audience: ["Engineers joining an unfamiliar codebase", "Reviewers planning a risky change"],
    capabilities: [
      "Map internal dependencies into navigable system areas",
      "Explain module responsibilities with source anchors",
      "Rank complexity and coupling hotspots for review",
      "Share a stable report tied to one commit"
    ],
    flow: [
      { title: "Repository submitted", description: "The web app validates a public GitHub URL and creates a durable analysis job.", modulePaths: ["app/page.tsx"] },
      { title: "Snapshot indexed", description: "The analyzer clones one commit, reads supported source files, and extracts internal imports.", modulePaths: ["lib/analyzer.ts"] },
      { title: "Graph scored", description: "Dependency edges become coupling metrics, complexity signals, and ranked hotspots.", modulePaths: ["lib/analyzer.ts", "analyzer/metrics.py"] },
      { title: "Modules explained", description: "DeepSeek receives bounded source context and returns validated, evidence-backed explanations.", modulePaths: ["lib/llm/client.ts"] },
      { title: "Report published", description: "The completed architecture report is persisted and opened through a shareable token.", modulePaths: ["worker/queue.ts", "packages/domain/types.ts"] }
    ],
    risks: ["Large repositories increase the time and cost of sequential module explanations.", "Dynamic imports can leave dependency edges unresolved."],
    confidence: "high",
    generatedBy: "deepseek-v4-flash",
    evidence: [
      { filePath: "lib/analyzer.ts", startLine: 1, endLine: 40, reason: "Defines the repository analysis pipeline and supported source boundaries." },
      { filePath: "app/page.tsx", startLine: 1, endLine: 30, reason: "Starts analysis from the repository URL interaction." }
    ]
  },
  diagram: {
    description: "Tracepath moves a repository from URL submission through static analysis and module explanation into a shareable architecture report.",
    nodes: [
      { id: "client", label: "Repository client", kind: "actor", description: "A user submits a public GitHub repository URL and opens the resulting report.", modulePaths: ["app/page.tsx"], evidence: [{ filePath: "app/page.tsx", startLine: 1, endLine: 30, reason: "Owns the repository URL interaction and report navigation." }], provenance: "observed", confidence: "high" },
      { id: "analysis", label: "Analysis pipeline", kind: "transform", description: "Clones the repository, indexes supported files, builds the syntax graph, and scores hotspots.", modulePaths: ["lib/analyzer.ts", "analyzer/metrics.py"], evidence: [{ filePath: "lib/analyzer.ts", startLine: 150, endLine: 215, reason: "Coordinates indexing, graphing, scoring, and report assembly." }], provenance: "observed", confidence: "high" },
      { id: "llm", label: "Module explanation", kind: "service", description: "DeepSeek turns bounded module context into validated explanations with evidence anchors.", modulePaths: ["lib/llm/client.ts"], evidence: [{ filePath: "lib/llm/client.ts", startLine: 1, endLine: 96, reason: "Adapts the model endpoint and validates summary output." }], provenance: "observed", confidence: "high" },
      { id: "queue", label: "Durable worker", kind: "worker", description: "BullMQ keeps long-running analysis work observable across retries.", modulePaths: ["worker/queue.ts"], evidence: [{ filePath: "worker/queue.ts", startLine: 1, endLine: 214, reason: "Owns queue work and progress publication." }], provenance: "observed", confidence: "high" },
      { id: "report", label: "Architecture report", kind: "artifact", description: "The report combines semantic diagrams, dependency maps, hotspots, and module explanations.", modulePaths: ["packages/domain/types.ts"], evidence: [{ filePath: "packages/domain/types.ts", startLine: 1, endLine: 128, reason: "Defines the report vocabulary shared by the system." }], provenance: "observed", confidence: "high" }
    ],
    relationships: [
      { id: "client-to-queue", source: "client", target: "queue", kind: "publishes", label: "starts analysis", evidence: [{ filePath: "app/page.tsx", startLine: 1, endLine: 30, reason: "Posts the repository URL to begin analysis." }], provenance: "observed", confidence: "high" },
      { id: "queue-to-analysis", source: "queue", target: "analysis", kind: "calls", label: "runs pipeline", evidence: [{ filePath: "worker/queue.ts", startLine: 1, endLine: 214, reason: "Dispatches analysis work to the worker." }], provenance: "observed", confidence: "high" },
      { id: "analysis-to-llm", source: "analysis", target: "llm", kind: "calls", label: "explains modules", evidence: [{ filePath: "lib/analyzer.ts", startLine: 196, endLine: 205, reason: "Requests a module explanation for each analyzed file." }], provenance: "observed", confidence: "high" },
      { id: "analysis-to-report", source: "analysis", target: "report", kind: "writes", label: "assembles report", evidence: [{ filePath: "lib/analyzer.ts", startLine: 208, endLine: 225, reason: "Assembles the immutable architecture report." }], provenance: "observed", confidence: "high" },
      { id: "llm-to-report", source: "llm", target: "report", kind: "publishes", label: "adds explanations", evidence: [{ filePath: "lib/llm/client.ts", startLine: 40, endLine: 96, reason: "Returns validated module summaries." }], provenance: "observed", confidence: "high" }
    ],
    generatedBy: "deepseek-v4-flash",
    confidence: "high"
  },
  systemDesign: {
    description: "Tracepath's logical system design separates the web/API surface, durable worker, persistence boundary, and model integration.",
    boundaries: [
      { id: "system", label: "Tracepath", description: "The logical containers owned by the analyzed repository.", kind: "system", evidence: [{ filePath: "README.md", startLine: 67, endLine: 92, reason: "Documents the web, worker, queue, and persistence architecture." }], provenance: "observed", confidence: "high" },
      { id: "external", label: "External systems", description: "Infrastructure and providers outside the repository boundary.", kind: "external", evidence: [], provenance: "inferred", confidence: "medium" }
    ],
    nodes: [
      { id: "web", label: "Web and API", kind: "container", description: "Accepts repository URLs, streams progress, and renders shareable reports.", technology: "Next.js", boundaryId: "system", modulePaths: ["app/page.tsx", "app/api/analyses/route.ts"], evidence: [{ filePath: "app/api/analyses/route.ts", startLine: 1, endLine: 35, reason: "Creates analysis jobs at the HTTP seam." }], provenance: "observed", confidence: "high" },
      { id: "worker", label: "Analysis worker", kind: "worker", description: "Runs the long-lived clone, parse, graph, scoring, and synthesis pipeline.", technology: "Node.js", boundaryId: "system", modulePaths: ["worker/index.ts", "lib/analysis-runner.ts"], evidence: [{ filePath: "worker/index.ts", startLine: 1, endLine: 18, reason: "Starts the BullMQ worker and dispatches analysis jobs." }], provenance: "observed", confidence: "high" },
      { id: "store", label: "Report store", kind: "store", description: "Persists jobs and completed reports for later retrieval.", technology: "PostgreSQL / file store", boundaryId: "system", modulePaths: ["lib/store.ts", "lib/persistence.ts"], evidence: [{ filePath: "lib/persistence.ts", startLine: 20, endLine: 66, reason: "Defines durable job and report persistence." }], provenance: "observed", confidence: "high" },
      { id: "queue", label: "Analysis queue", kind: "queue", description: "Buffers long-running analysis work between HTTP and worker processes.", technology: "BullMQ / Redis", boundaryId: "external", modulePaths: ["lib/queue.ts"], evidence: [{ filePath: "lib/queue.ts", startLine: 1, endLine: 24, reason: "Creates and publishes jobs to the tracepath-analysis queue." }], provenance: "observed", confidence: "high" },
      { id: "llm", label: "Model provider", kind: "external-system", description: "Optionally enriches module and architecture explanations.", technology: "OpenAI-compatible endpoint", boundaryId: "external", modulePaths: ["lib/analyzer.ts"], evidence: [{ filePath: "lib/analyzer.ts", startLine: 200, endLine: 236, reason: "Calls the configured model endpoint with bounded source context." }], provenance: "observed", confidence: "high" }
    ],
    relationships: [
      { id: "web-queue", source: "web", target: "queue", kind: "publishes", label: "enqueues analysis", protocol: "BullMQ", evidence: [{ filePath: "app/api/analyses/route.ts", startLine: 24, endLine: 34, reason: "Attempts remote queue dispatch before using the local runner." }], provenance: "observed", confidence: "high" },
      { id: "queue-worker", source: "queue", target: "worker", kind: "calls", label: "dispatches job", protocol: "Redis", evidence: [{ filePath: "worker/index.ts", startLine: 7, endLine: 10, reason: "Consumes the tracepath-analysis queue." }], provenance: "observed", confidence: "high" },
      { id: "worker-store", source: "worker", target: "store", kind: "writes", label: "saves report", evidence: [{ filePath: "lib/analysis-runner.ts", startLine: 8, endLine: 14, reason: "Persists the completed report and updates job state." }], provenance: "observed", confidence: "high" },
      { id: "worker-llm", source: "worker", target: "llm", kind: "calls", label: "requests explanations", protocol: "HTTPS", evidence: [{ filePath: "lib/analyzer.ts", startLine: 205, endLine: 236, reason: "Requests validated summaries from the configured provider." }], provenance: "observed", confidence: "high" },
      { id: "web-store", source: "web", target: "store", kind: "reads", label: "loads report", protocol: "HTTP", evidence: [{ filePath: "app/api/reports/[token]/route.ts", startLine: 1, endLine: 11, reason: "Reads a report by share token." }], provenance: "observed", confidence: "high" }
    ],
    generatedBy: "deepseek-v4-flash",
    confidence: "high"
  },
  modules: [
    { id: "m1", path: "app/page.tsx", language: "typescript", cluster: "app", metric: { complexity: 8, lines: 182, fanIn: 0, fanOut: 5, hotspotScore: 58 }, summary: { modulePath: "app/page.tsx", purpose: "Composes the landing experience and starts an analysis from a repository URL.", responsibilities: ["Owns the first-run interaction", "Streams analysis status into the report route"], keyFlows: ["URL input → POST /api/analyses → report token"], dependencies: ["lib/analyzer", "lib/store"], risks: ["The landing page is a high-traffic seam."], confidence: "high", generatedBy: "deepseek-v4-flash" } },
    { id: "m2", path: "lib/analyzer.ts", language: "typescript", cluster: "analyzer", metric: { complexity: 21, lines: 426, fanIn: 4, fanOut: 8, hotspotScore: 91 }, summary: { modulePath: "lib/analyzer.ts", purpose: "Runs the complete repository archaeology pipeline and returns an immutable architecture report.", responsibilities: ["Clone and enforce resource limits", "Extract edges, metrics, and module explanations"], keyFlows: ["Clone → index → graph → score → summarize → persist"], dependencies: ["node:child_process", "OpenAI adapter", "validation schemas"], risks: ["Highest complexity and coupling in the current snapshot."], confidence: "high", generatedBy: "deepseek-v4-flash" } },
    { id: "m3", path: "lib/llm/client.ts", language: "typescript", cluster: "analyzer", metric: { complexity: 5, lines: 96, fanIn: 2, fanOut: 1, hotspotScore: 39 }, summary: { modulePath: "lib/llm/client.ts", purpose: "Adapts the OpenAI-compatible CKey endpoint into validated module summaries.", responsibilities: ["Build constrained prompts", "Validate JSON and fall back safely"], keyFlows: ["Module context → DeepSeek → Zod schema"], dependencies: ["openai", "lib/validation"], risks: ["Provider response shape can vary across routes."], confidence: "high", generatedBy: "deepseek-v4-flash" } },
    { id: "m4", path: "worker/queue.ts", language: "typescript", cluster: "worker", metric: { complexity: 12, lines: 214, fanIn: 1, fanOut: 4, hotspotScore: 67 }, summary: { modulePath: "worker/queue.ts", purpose: "Makes analysis work durable and observable across worker retries.", responsibilities: ["Enqueue jobs", "Publish progress events"], keyFlows: ["HTTP request → Redis queue → worker stages"], dependencies: ["bullmq", "redis", "lib/analyzer"], risks: ["Retry policy must avoid duplicate report versions."], confidence: "medium", generatedBy: "deepseek-v4-flash" } },
    { id: "m5", path: "packages/domain/types.ts", language: "typescript", cluster: "shared", metric: { complexity: 1, lines: 128, fanIn: 7, fanOut: 0, hotspotScore: 35 }, summary: { modulePath: "packages/domain/types.ts", purpose: "Defines the shared report vocabulary consumed by the API, worker, and UI.", responsibilities: ["Keep graph and summary contracts aligned"], keyFlows: ["Validated at the API seam and rendered by the inspector"], dependencies: [], risks: [], confidence: "high", generatedBy: "deepseek-v4-flash" } },
    { id: "m6", path: "analyzer/metrics.py", language: "python", cluster: "analyzer", metric: { complexity: 17, lines: 301, fanIn: 3, fanOut: 3, hotspotScore: 76 }, summary: { modulePath: "analyzer/metrics.py", purpose: "Computes deterministic complexity and coupling metrics for Python modules.", responsibilities: ["Count branching paths", "Rank review candidates"], keyFlows: ["Parsed syntax → normalized metric record"], dependencies: ["ast", "pathlib"], risks: ["Heuristic parsing can undercount dynamic imports."], confidence: "medium", generatedBy: "deepseek-v4-flash" } }
  ],
  edges: [
    { source: "app/page.tsx", target: "lib/analyzer.ts", kind: "import" }, { source: "app/page.tsx", target: "lib/store.ts", kind: "import" },
    { source: "lib/analyzer.ts", target: "lib/llm/client.ts", kind: "import" }, { source: "lib/analyzer.ts", target: "analyzer/metrics.py", kind: "from" },
    { source: "worker/queue.ts", target: "lib/analyzer.ts", kind: "import" }, { source: "lib/llm/client.ts", target: "packages/domain/types.ts", kind: "import" },
    { source: "analyzer/metrics.py", target: "packages/domain/types.ts", kind: "from" }, { source: "lib/store.ts", target: "packages/domain/types.ts", kind: "import" }
  ]
};
