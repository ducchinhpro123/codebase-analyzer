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
    summary: "Tracepath explains an unfamiliar software project in plain language. Paste a public GitHub link and it turns the repository into a visual report of what the project is for, how its main ideas connect, and where maintainers may need to be careful.",
    problem: "People evaluating or joining a software project often have to read thousands of unfamiliar files before they can understand what the project actually does or whether it is safe to change.",
    outcome: "A newcomer can understand the project's purpose, main journey, and important risks from one shareable report before deciding where to investigate further.",
    audience: ["People evaluating an unfamiliar software project", "Teams preparing to maintain or change it"],
    capabilities: [
      "Understand the project's purpose before opening its code",
      "See the main journey from a user's need to the project's outcome",
      "Find the parts most worth investigating next",
      "Share a stable explanation tied to one project version"
    ],
    flow: [
      { title: "Choose a project", description: "Paste a public GitHub link for the project you want to understand.", modulePaths: ["app/page.tsx"] },
      { title: "Gather the story", description: "Tracepath reads the project context and gathers evidence about what it is trying to do.", modulePaths: ["lib/analyzer.ts"] },
      { title: "Explain the purpose", description: "The LLM translates that evidence into the problem, audience, outcome, and main journey.", modulePaths: ["lib/analyzer.ts", "lib/llm/client.ts"] },
      { title: "Show what matters", description: "The report highlights useful next steps and important limitations without requiring a code tour.", modulePaths: ["packages/domain/types.ts"] }
    ],
    risks: ["Large repositories increase the time and cost of sequential module explanations.", "Dynamic imports can leave dependency edges unresolved."],
    confidence: "high",
    generatedBy: "sample-llm",
    evidence: [
      { filePath: "lib/analyzer.ts", startLine: 1, endLine: 40, reason: "Defines the repository analysis pipeline and supported source boundaries." },
      { filePath: "app/page.tsx", startLine: 1, endLine: 30, reason: "Starts analysis from the repository URL interaction." }
    ]
  },
  diagram: {
    description: "A newcomer brings an unfamiliar project to Tracepath and receives a plain-language explanation plus clear places to investigate next.",
    nodes: [
      { id: "newcomer", label: "Curious newcomer", kind: "actor", description: "Someone wants to understand a project before reading its code.", modulePaths: ["app/page.tsx"], evidence: [{ filePath: "app/page.tsx", startLine: 1, endLine: 30, reason: "Provides the repository submission and report experience." }], provenance: "observed", confidence: "high" },
      { id: "unfamiliar-project", label: "Unfamiliar project", kind: "boundary", description: "Its purpose and important ideas are buried across many files.", modulePaths: ["lib/analyzer.ts"], evidence: [{ filePath: "README.md", startLine: 1, endLine: 20, reason: "Describes the difficulty of understanding an unfamiliar repository." }], provenance: "observed", confidence: "high" },
      { id: "guided-reading", label: "Guided project reading", kind: "transform", description: "Tracepath gathers evidence and translates it into ordinary language.", modulePaths: ["lib/analyzer.ts", "analyzer/metrics.py"], evidence: [{ filePath: "lib/analyzer.ts", startLine: 150, endLine: 215, reason: "Coordinates the evidence-backed project analysis." }], provenance: "observed", confidence: "high" },
      { id: "clear-purpose", label: "Clear purpose", kind: "artifact", description: "The newcomer learns what the project does and why it exists.", modulePaths: ["lib/analyzer.ts"], evidence: [{ filePath: "lib/analyzer.ts", startLine: 230, endLine: 300, reason: "Generates the plain-language project overview." }], provenance: "observed", confidence: "high" },
      { id: "next-steps", label: "Confident next steps", kind: "artifact", description: "They know what matters and where deeper investigation may be useful.", modulePaths: ["packages/domain/types.ts"], evidence: [{ filePath: "packages/domain/types.ts", startLine: 1, endLine: 128, reason: "Defines the report information presented to the reader." }], provenance: "observed", confidence: "high" }
    ],
    relationships: [
      { id: "newcomer-to-project", source: "newcomer", target: "unfamiliar-project", kind: "reads", label: "needs to understand", evidence: [{ filePath: "app/page.tsx", startLine: 1, endLine: 30, reason: "Accepts the project the newcomer wants explained." }], provenance: "observed", confidence: "high" },
      { id: "project-to-reading", source: "unfamiliar-project", target: "guided-reading", kind: "transforms", label: "is examined by", evidence: [{ filePath: "lib/analyzer.ts", startLine: 150, endLine: 215, reason: "Analyzes the submitted project using bounded evidence." }], provenance: "observed", confidence: "high" },
      { id: "reading-to-purpose", source: "guided-reading", target: "clear-purpose", kind: "publishes", label: "explains", evidence: [{ filePath: "lib/analyzer.ts", startLine: 230, endLine: 300, reason: "Produces the project-level explanation." }], provenance: "observed", confidence: "high" },
      { id: "purpose-to-next-steps", source: "clear-purpose", target: "next-steps", kind: "transforms", label: "supports", evidence: [{ filePath: "packages/domain/types.ts", startLine: 1, endLine: 128, reason: "Carries the overview and evidence into the report." }], provenance: "observed", confidence: "high" }
    ],
    generatedBy: "sample-llm",
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
    generatedBy: "sample-llm",
    confidence: "high"
  },
  modules: [
      { id: "m1", path: "app/page.tsx", language: "typescript", cluster: "app", metric: { complexity: 8, lines: 182, fanIn: 0, fanOut: 5, hotspotScore: 58 }, summary: { modulePath: "app/page.tsx", purpose: "Composes the landing experience and starts an analysis from a repository URL.", responsibilities: ["Owns the first-run interaction", "Streams analysis status into the report route"], keyFlows: ["URL input → POST /api/analyses → report token"], dependencies: ["lib/analyzer", "lib/store"], risks: ["The landing page is a high-traffic seam."], confidence: "high", generatedBy: "sample-llm" } },
    { id: "m2", path: "lib/analyzer.ts", language: "typescript", cluster: "analyzer", metric: { complexity: 21, lines: 426, fanIn: 4, fanOut: 8, hotspotScore: 91 }, summary: { modulePath: "lib/analyzer.ts", purpose: "Runs the complete repository archaeology pipeline and returns an immutable architecture report.", responsibilities: ["Clone and enforce resource limits", "Extract edges, metrics, and module explanations"], keyFlows: ["Clone → index → graph → score → summarize → persist"], dependencies: ["node:child_process", "OpenAI adapter", "validation schemas"], risks: ["Highest complexity and coupling in the current snapshot."], confidence: "high", generatedBy: "sample-llm" } },
      { id: "m3", path: "lib/llm/client.ts", language: "typescript", cluster: "analyzer", metric: { complexity: 5, lines: 96, fanIn: 2, fanOut: 1, hotspotScore: 39 }, summary: { modulePath: "lib/llm/client.ts", purpose: "Adapts the configured language-model endpoint into validated module summaries.", responsibilities: ["Build constrained prompts", "Validate JSON and fall back safely"], keyFlows: ["Module context → configured LLM → validated summary"], dependencies: ["openai", "lib/validation"], risks: ["Provider response shape can vary across routes."], confidence: "high", generatedBy: "sample-llm" } },
    { id: "m4", path: "worker/queue.ts", language: "typescript", cluster: "worker", metric: { complexity: 12, lines: 214, fanIn: 1, fanOut: 4, hotspotScore: 67 }, summary: { modulePath: "worker/queue.ts", purpose: "Makes analysis work durable and observable across worker retries.", responsibilities: ["Enqueue jobs", "Publish progress events"], keyFlows: ["HTTP request → Redis queue → worker stages"], dependencies: ["bullmq", "redis", "lib/analyzer"], risks: ["Retry policy must avoid duplicate report versions."], confidence: "medium", generatedBy: "sample-llm" } },
    { id: "m5", path: "packages/domain/types.ts", language: "typescript", cluster: "shared", metric: { complexity: 1, lines: 128, fanIn: 7, fanOut: 0, hotspotScore: 35 }, summary: { modulePath: "packages/domain/types.ts", purpose: "Defines the shared report vocabulary consumed by the API, worker, and UI.", responsibilities: ["Keep graph and summary contracts aligned"], keyFlows: ["Validated at the API seam and rendered by the inspector"], dependencies: [], risks: [], confidence: "high", generatedBy: "sample-llm" } },
    { id: "m6", path: "analyzer/metrics.py", language: "python", cluster: "analyzer", metric: { complexity: 17, lines: 301, fanIn: 3, fanOut: 3, hotspotScore: 76 }, summary: { modulePath: "analyzer/metrics.py", purpose: "Computes deterministic complexity and coupling metrics for Python modules.", responsibilities: ["Count branching paths", "Rank review candidates"], keyFlows: ["Parsed syntax → normalized metric record"], dependencies: ["ast", "pathlib"], risks: ["Heuristic parsing can undercount dynamic imports."], confidence: "medium", generatedBy: "sample-llm" } }
  ],
  edges: [
    { source: "app/page.tsx", target: "lib/analyzer.ts", kind: "import" }, { source: "app/page.tsx", target: "lib/store.ts", kind: "import" },
    { source: "lib/analyzer.ts", target: "lib/llm/client.ts", kind: "import" }, { source: "lib/analyzer.ts", target: "analyzer/metrics.py", kind: "from" },
    { source: "worker/queue.ts", target: "lib/analyzer.ts", kind: "import" }, { source: "lib/llm/client.ts", target: "packages/domain/types.ts", kind: "import" },
    { source: "analyzer/metrics.py", target: "packages/domain/types.ts", kind: "from" }, { source: "lib/store.ts", target: "packages/domain/types.ts", kind: "import" }
  ]
};
