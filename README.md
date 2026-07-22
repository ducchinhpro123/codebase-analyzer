# Tracepath

**Map the code. Find the risk.**

Tracepath turns a public GitHub repository into an evidence-backed architecture
report. It builds an interactive dependency map, identifies deterministic
complexity hotspots, explains modules in plain language, and exports a
high-level data-flow diagram.

Unlike a generic “chat with your repository” demo, Tracepath keeps every
architectural claim connected to observed source files and labels inferred
relationships explicitly.

## What it shows

- A repository overview with capabilities, architecture flow, and review risks
- An interactive module graph built from parsed imports
- Hotspots ranked by complexity, coupling, and module size
- Evidence anchors linking summaries back to source locations
- Observed versus inferred relationships with confidence signals
- SVG, PNG, and Draw.io architecture-diagram exports
- Shareable, unlisted report URLs
- Live analysis progress over server-sent events

JavaScript, TypeScript, and Python repositories are supported. AI summaries are
optional: without an API key, Tracepath produces deterministic fallback
summaries from the static analysis.

## Quick start

Requirements: Node.js 20 or newer and Git.

```bash
git clone https://github.com/ducchinhpro123/codebase-analyzer.git
cd codebase-analyzer

npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Paste a public GitHub repository URL or explore
the built-in report at <http://localhost:3000/report/demo>.

## Optional AI summaries

Set an OpenAI-compatible endpoint in `.env.local`:

```dotenv
LLM_API_KEY=your-key-here
LLM_BASE_URL=https://api.example.com/v1
LLM_MODEL=your-model
LLM_CONCURRENCY=4
```

The model receives bounded source context and returns structured module
summaries. Its output is validated before it enters a report; deterministic
metrics and syntax relationships never depend on the model.

## Operating modes

### Lightweight local mode

`npm run dev` runs the Next.js application with an isolated file-backed store.
This is the fastest way to evaluate the UI and analyzer without infrastructure.

### Durable worker mode

```bash
docker compose up --build
```

Compose starts:

- Next.js web and API process
- A separate BullMQ analysis worker
- Redis for the durable job queue
- PostgreSQL for jobs and reports

The same application interfaces support both modes, keeping local development
lightweight while demonstrating a production-shaped execution path.

## Architecture

```text
Browser
  │  POST analysis / SSE progress / GET report
  ▼
Next.js API ───────► job store ───────► BullMQ / Redis
                                           │
                                           ▼
                                      analysis worker
                                           │
                         clone → parse → graph → summarize
                                           │
                                           ▼
                                   PostgreSQL report store
```

| Module | Responsibility |
| --- | --- |
| `lib/analyzer.ts` | Bounded cloning, source discovery, parsing, dependency graph construction, scoring, and summary validation |
| `lib/analysis-runner.ts` | Analysis lifecycle and progress orchestration |
| `lib/store.ts` | Storage boundary shared by local and durable adapters |
| `worker/index.ts` | BullMQ worker entry point |
| `app/api` | Job creation, status, SSE progress, and report retrieval |
| `app/components/AnalyzerShell.tsx` | Landing flow, analysis progress, diagram, module explorer, and evidence UI |
| `lib/diagram-export.ts` | Deterministic SVG, PNG-source, and Draw.io export generation |

Architectural choices are recorded in [`docs/adr`](docs/adr), including why
overview claims require evidence and why inferred diagram edges remain
conservative.

## Safety boundaries

Tracepath treats analyzed repositories as untrusted input.

- It never builds or executes repository code.
- It reads only bounded JS, TS, and Python source from a detached clone.
- Repository size and source-file counts are capped through environment settings.
- Temporary clones are removed when analysis finishes.
- User input and model responses are schema-validated.
- Public GitHub URLs are normalized and validated before cloning.

The default limits are 10,000 files and 100 MiB. They can be adjusted with
`ANALYZER_MAX_FILES` and `ANALYZER_MAX_BYTES`.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

The test suite covers concurrency limits, request validation, HTTP seams,
repository overview generation, semantic diagrams, exportable relationships,
and GitHub URL normalization.

## Current limitations

- Only public GitHub repositories are accepted.
- Static relationships are architectural evidence, not proof of runtime order.
- Language coverage currently focuses on JavaScript, TypeScript, and Python.
- The default Compose credentials are for local development and must be
  replaced before any public deployment.
