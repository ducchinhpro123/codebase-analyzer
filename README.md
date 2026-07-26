# Tracepath

**Map the code. Find the risk.**

Tracepath turns a public GitHub repository into an evidence-backed architecture
report. It builds an interactive dependency map, identifies deterministic
complexity hotspots, explains modules in plain language, and exports both a
high-level data-flow diagram and a C4-style system-design view.

Unlike a generic “chat with your repository” demo, Tracepath keeps every
architectural claim connected to observed source files and labels inferred
relationships explicitly.

## What it shows

- A repository overview with capabilities, architecture flow, and review risks
- An interactive module graph built from parsed imports
- A Mermaid-rendered system-design architecture showing logical containers, workers, stores, queues, and external systems
- Hotspots ranked by complexity, coupling, and module size
- Evidence anchors linking summaries back to source locations
- Observed versus inferred relationships with confidence signals
- SVG, PNG, and Draw.io exports for both architecture views
- Shareable, unlisted report URLs
- Live analysis progress over server-sent events

Repositories in any text-based programming language are indexed, including
mixed-language codebases and files with unfamiliar source extensions. An LLM
API key is required for new analyses because the plain-language Big Picture and
its Mermaid concept map are generated from an evidence-backed model reading.

### Dependency graph coverage

Every indexed file is read, scored, and explained. The dependency graph is built
from imports, which are parsed per language:

| Read | Languages |
| --- | --- |
| Imports parsed and resolved to repository files | TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Scala, Groovy, C#, C, C++, Objective-C, Ruby, PHP, Elixir, Swift, Dart, Lua, Perl, shell, Vue, Svelte, Astro |
| Indexed and explained, but contributing no edges | every other language |

A language not in the first row still appears in the report with metrics and a
module explanation; it simply adds no edges. The architecture map states the
share of files its graph was built from, so a sparse graph reads as a limit of
the analysis rather than a finding about the code.

Imports are matched per language with comment and string awareness, not parsed
into full syntax trees. Ordinary import, use, include, and require forms are
read; imports produced by macros or code generation are not.

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

## LLM configuration

Set an OpenAI-compatible endpoint in `.env.local` before running an analysis:

```dotenv
LLM_API_KEY=your-key-here
LLM_BASE_URL=https://api.example.com/v1
LLM_MODEL=your-model
LLM_CONCURRENCY=4
LLM_SUMMARY_BUDGET=120
```

The model receives bounded repository context and returns the plain-language
project purpose, problem, outcome, user journey, concept map, and module
summaries. Its output is validated before it enters a report; deterministic
metrics and syntax relationships never depend on the model. The built-in sample
report remains available without an API key.

`LLM_SUMMARY_BUDGET` caps how many modules the model explains in one analysis.
Modules are ranked by coupling and hotspot score — the same ranking the Big
Picture, concept map, and system-design views use to choose their own context —
so the modules those views read are always covered. Modules outside the budget
keep their deterministic explanation, which the report labels as such. Lowering
the budget makes large repositories cheaper and faster to analyze; raising it
extends model-written explanations further down the module list.

An analysis first reads the repository's current head commit without cloning it.
If a report already exists for that exact commit, it is reused and its existing
share URL is returned instead of re-cloning and re-reading the codebase.

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
| `lib/diagram-export.ts` | Deterministic SVG, PNG-source, and Draw.io export generation for both architecture views |
| `lib/system-design.ts` | Evidence-backed C4 container synthesis and legacy-report normalization |

Architectural choices are recorded in [`docs/adr`](docs/adr), including why
overview claims require evidence and why inferred diagram edges remain
conservative.

## Safety boundaries

Tracepath treats analyzed repositories as untrusted input.

- It never builds or executes repository code.
- It reads only bounded text source from a detached clone; binary assets,
  prose documentation, lockfiles, and common generated directories are skipped.
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
- System-design containers and integrations are logical, evidence-backed interpretations; they are not a deployment topology or runtime trace.
- Import extraction is deepest for JavaScript, TypeScript, and Python; other
  languages still receive module, metric, hotspot, evidence, and AI analysis.
- The default Compose credentials are for local development and must be
  replaced before any public deployment.
