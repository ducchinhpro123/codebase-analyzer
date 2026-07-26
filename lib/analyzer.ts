import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import OpenAI from "openai";
import { parseJavaScriptImports } from "./ast";
import { mapWithConcurrency } from "./concurrency";
import { buildFallbackProjectOverview } from "./project-overview";
import { normalizeProjectOverviewCandidate, normalizeRepositoryDiagramCandidate, normalizeRepositorySystemDesignCandidate } from "./llm-normalization";
import { isAnalyzableSourceFile, languageFor } from "./source-files";
import { buildFallbackSystemDesign, normalizeSystemDesign, type ArchitectureContextFile } from "./system-design";
import { llmSummarySchema, projectOverviewSchema, repositoryDiagramSchema, repositorySystemDesignSchema } from "./validation";
import type {
  AnalysisReport,
  AnalysisStage,
  AnalyzedModule,
  DependencyEdge,
  Language,
  ModuleMetric,
  ModuleSummary,
  ProjectOverview,
  RepositoryDiagram,
  RepositorySystemDesign
} from "./types";

const execFileAsync = promisify(execFile);
const IGNORED = new Set([
  ".git",
  ".gradle",
  ".idea",
  ".next",
  ".nuxt",
  ".pytest_cache",
  ".tox",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "env",
  "node_modules",
  "obj",
  "target",
  "vendor",
  "venv"
]);
const MAX_FILES = Number(process.env.ANALYZER_MAX_FILES ?? 10_000);
const MAX_BYTES = Number(process.env.ANALYZER_MAX_BYTES ?? 100 * 1024 * 1024);

function configuredModel() {
  const model = process.env.LLM_MODEL?.trim();
  if (!model) throw new Error("LLM_MODEL must be configured for repository analysis");
  return model;
}

function llmFailure(message: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`${message}: ${detail.slice(0, 800)}`, { cause: error });
}

type Progress = (stage: AnalysisStage, progress: number, message: string) => void;
type IndexedFile = { path: string; language: Language; source: string; lines: number };
type ProjectContextFile = ArchitectureContextFile;

async function listSourceFiles(root: string): Promise<IndexedFile[]> {
  const files: IndexedFile[] = [];
  let totalBytes = 0;

  async function visit(relative: string) {
    const absolute = path.join(root, relative);
    for (const entry of await fs.readdir(absolute, { withFileTypes: true })) {
      if (IGNORED.has(entry.name)) continue;
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        await visit(child);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = await fs.stat(path.join(root, child));
      if (stat.size > MAX_BYTES) continue;
      const content = await fs.readFile(path.join(root, child));
      if (!isAnalyzableSourceFile(child, content)) continue;
      if (files.length >= MAX_FILES) throw new Error(`Repository exceeds the ${MAX_FILES.toLocaleString()} file limit`);
      totalBytes += stat.size;
      if (totalBytes > MAX_BYTES) throw new Error(`Repository exceeds the ${(MAX_BYTES / 1024 / 1024).toLocaleString()} MB source limit`);
      const source = content.toString("utf8");
      files.push({ path: child.split(path.sep).join("/"), language: languageFor(child, source), source, lines: source.split(/\r?\n/).length });
    }
  }

  await visit("");
  return files;
}

async function readProjectContext(root: string): Promise<ProjectContextFile[]> {
  const rootEntries = await fs.readdir(root, { withFileTypes: true });
  const names = rootEntries
    .filter((entry) => entry.isFile() && (
      /^readme(?:\.[^.]+)?$/i.test(entry.name)
      || /^(package\.json|pyproject\.toml|cargo\.toml|go\.mod|requirements(?:\.[^.]+)?|procfile|dockerfile|docker-compose(?:\.[^.]+)?|compose(?:\.[^.]+)?|next\.config\.[^.]+|vite\.config\.[^.]+|tsconfig\.json)$/i.test(entry.name)
      || /^\.env\.example$/i.test(entry.name)
    ))
    .map((entry) => entry.name)
    .slice(0, 12);
  const context: ProjectContextFile[] = [];
  for (const name of names) {
    const filePath = path.join(root, name);
    const stat = await fs.stat(filePath);
    if (stat.size > 256 * 1024) continue;
    const source = await fs.readFile(filePath, "utf8");
    context.push({ path: name, source: source.slice(0, 24_000), lines: source.split(/\r?\n/).length });
  }
  return context;
}

function readmeSummary(context: ProjectContextFile[]) {
  const readme = context.find((file) => /^readme/i.test(file.path));
  if (!readme) return undefined;
  const prose = readme.source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim())
    .find((paragraph) => paragraph.length >= 60 && !/^https?:/i.test(paragraph));
  return prose?.slice(0, 700);
}

function importsFor(file: IndexedFile) {
  const imports: { specifier: string; kind: DependencyEdge["kind"]; line: number }[] = [];
  if (file.language === "python") {
    for (const match of file.source.matchAll(/^\s*from\s+([\w.]+)\s+import|^\s*import\s+([\w.]+)/gm)) {
      imports.push({ specifier: match[1] ?? match[2], kind: "from", line: file.source.slice(0, match.index ?? 0).split(/\r?\n/).length });
    }
  } else {
    try {
      return parseJavaScriptImports(file.source);
    } catch {
      for (const match of file.source.matchAll(/\bimport\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']\s*\)/g)) {
        imports.push({ specifier: match[1] ?? match[2], kind: match[1] ? "import" : "require", line: file.source.slice(0, match.index ?? 0).split(/\r?\n/).length });
      }
    }
  }
  return imports;
}

function resolveImport(source: IndexedFile, specifier: string, paths: Set<string>) {
  const relative = specifier.startsWith(".");
  const pythonRelativeDepth = source.language === "python" && relative ? specifier.match(/^\.+/)?.[0].length ?? 0 : 0;
  let sourceDirectory = path.posix.dirname(source.path);
  for (let level = 1; level < pythonRelativeDepth; level += 1) sourceDirectory = path.posix.dirname(sourceDirectory);
  const normalizedSpecifier = pythonRelativeDepth ? specifier.slice(pythonRelativeDepth).replace(/\./g, "/") : specifier;
  const base = relative
    ? path.posix.normalize(path.posix.join(sourceDirectory, normalizedSpecifier))
    : source.language === "python"
      ? specifier.replace(/\./g, "/")
      : "";
  if (!base) return undefined;
  const candidates = [base, ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"].map((ext) => `${base}${ext}`), ...[".ts", ".tsx", ".js", ".jsx", ".py"].map((ext) => `${base}/index${ext}`), `${base}/__init__.py`];
  const directMatch = candidates.find((candidate) => paths.has(candidate));
  if (directMatch) return directMatch;
  if (source.language !== "python" || relative) return undefined;
  return [...paths].find((modulePath) => candidates.some((candidate) => modulePath.endsWith(`/${candidate}`)));
}

function metricFor(file: IndexedFile, fanIn: number, fanOut: number): ModuleMetric {
  const branchMatches = file.source.match(/\b(if|else if|for|while|case|catch|&&|\|\||\?)\b/g)?.length ?? 0;
  const complexity = Math.max(1, branchMatches + 1);
  const hotspotScore = Math.round(Math.min(99, complexity * 2.4 + Math.log2(file.lines + 1) * 5 + fanIn * 5 + fanOut * 2));
  return { complexity, lines: file.lines, fanIn, fanOut, hotspotScore };
}

function fallbackSummary(file: IndexedFile, metric: ModuleMetric, dependencyNames: string[]): ModuleSummary {
  const baseName = path.basename(file.path).replace(/\.(tsx?|jsx?|mjs|cjs|py)$/, "");
  const purpose = baseName === "index" || baseName === "main" ? "Entry point that wires the module graph together." : `The ${baseName.replace(/[-_]/g, " ")} module.`;
  const firstInterestingLine = Math.max(1, file.source.split(/\r?\n/).findIndex((line) => /\b(import|export|class|function|def|async)\b/.test(line)) + 1);
  return {
    modulePath: file.path,
    purpose,
    responsibilities: [
      `Owns ${metric.lines} lines of ${file.language} implementation`,
      dependencyNames.length ? `Coordinates ${dependencyNames.length} imported module${dependencyNames.length === 1 ? "" : "s"}` : "Provides a leaf implementation with no local imports"
    ],
    keyFlows: ["Read the exported functions and follow the highlighted dependency edges."],
    dependencies: dependencyNames.slice(0, 8),
    risks: metric.hotspotScore > 60 ? ["High combined complexity and coupling; worth a focused review."] : [],
    confidence: "low",
    generatedBy: "deterministic-fallback",
    evidence: [{ filePath: file.path, startLine: firstInterestingLine, endLine: Math.min(file.lines, firstInterestingLine + 18), reason: "Module source anchor used for the deterministic explanation and metric context." }]
  };
}

async function summarizeWithLlm(file: IndexedFile, metric: ModuleMetric, dependencyNames: string[]): Promise<ModuleSummary> {
  const fallback = fallbackSummary(file, metric, dependencyNames);
  const apiKey = process.env.LLM_API_KEY ?? process.env.CKEY_API_KEY;
  if (!apiKey) return fallback;
  const model = configuredModel();
  try {
    const client = new OpenAI({ apiKey, baseURL: process.env.LLM_BASE_URL ?? process.env.CKEY_BASE_URL ?? "https://api.xah.io/v1" });
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a careful code archaeologist. Return only valid JSON matching the requested shape. Describe observed behavior, mark uncertainty, and never invent APIs." },
        {
          role: "user",
          content: JSON.stringify({
            task: "Explain one source module for an architecture report.",
            shape: { modulePath: "string", purpose: "string", responsibilities: ["string"], keyFlows: ["string"], dependencies: ["string"], risks: ["string"], confidence: "low | medium | high", evidence: [{ filePath: "string", startLine: 1, endLine: 2, reason: "string" }] },
            modulePath: file.path,
            language: file.language,
            metrics: metric,
            importedModules: dependencyNames,
            sourceExcerpt: file.source.split(/\r?\n/).slice(0, 220).map((line, index) => `${index + 1}: ${line}`).join("\n")
          })
        }
      ]
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return fallback;
    const parsed = llmSummarySchema.parse(JSON.parse(raw));
    const evidence = parsed.evidence.filter((item) => item.filePath === file.path && item.startLine <= item.endLine && item.startLine <= file.lines).map((item) => ({ ...item, endLine: Math.min(item.endLine, file.lines) }));
    return { ...parsed, evidence: evidence.length ? evidence : fallback.evidence, generatedBy: model };
  } catch {
    return fallback;
  }
}

export async function summarizeProjectWithLlm(input: {
  repositoryName: string;
  languages: Language[];
  modules: AnalyzedModule[];
  edges: DependencyEdge[];
  sourceFiles: IndexedFile[];
  contextFiles: ProjectContextFile[];
}): Promise<ProjectOverview> {
  const fallback = buildFallbackProjectOverview({
    repositoryName: input.repositoryName,
    languages: input.languages,
    modules: input.modules,
    readmeSummary: readmeSummary(input.contextFiles)
  });
  const apiKey = process.env.LLM_API_KEY ?? process.env.CKEY_API_KEY;
  if (!apiKey) throw new Error("Big Picture analysis requires LLM_API_KEY or CKEY_API_KEY");
  const model = configuredModel();

  try {
    const modulePaths = new Set(input.modules.map((module) => module.path));
    const evidenceSources = new Map([
      ...input.sourceFiles.map((file) => [file.path, file.lines] as const),
      ...input.contextFiles.map((file) => [file.path, file.lines] as const)
    ]);
    const importantModules = [...input.modules]
      .sort((a, b) => (b.metric.fanIn + b.metric.fanOut + b.metric.hotspotScore / 20) - (a.metric.fanIn + a.metric.fanOut + a.metric.hotspotScore / 20))
      .slice(0, 80);
    const internalEdges = input.edges.filter((edge) => modulePaths.has(edge.target)).slice(0, 240);
    const client = new OpenAI({ apiKey, baseURL: process.env.LLM_BASE_URL ?? process.env.CKEY_BASE_URL ?? "https://api.xah.io/v1" });
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You explain software products to a curious person who knows nothing about code. Explain the analyzed project itself, not the analysis tool or repository structure. Lead with the human problem, the project's purpose, and the useful outcome. Use ordinary language. Do not mention frameworks, files, modules, APIs, databases, implementation patterns, or code metrics unless one is essential to understanding what the product does. Return only valid JSON matching the requested shape. Ground every claim in the supplied evidence and state uncertainty instead of inventing features."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Create a plain-language Big Picture for someone deciding what this project is, what problem it solves, who it helps, and what happens when it is used. The reader has no programming knowledge.",
            shape: {
              summary: "two or three plain-language sentences answering: what is this project and why does it exist?",
              problem: "the real-world frustration, limitation, or unmet need this project addresses",
              outcome: "the practical change or benefit a user gets after using it",
              audience: ["plain-language description of a person or organization helped by the project"],
              capabilities: ["something a user can accomplish with the project, phrased without implementation jargon"],
              flow: [{ title: "short user-facing stage name", description: "what the person experiences or what conceptually happens, without code terminology", modulePaths: ["exact supplied module path used only as hidden supporting evidence"] }],
              risks: ["user-relevant limitation, tradeoff, or important uncertainty; never a code-quality metric"],
              confidence: "low | medium | high",
              evidence: [{ filePath: "exact supplied path", startLine: 1, endLine: 2, reason: "claim supported by this location" }]
            },
            repositoryName: input.repositoryName,
            languages: input.languages,
            projectFiles: input.contextFiles.map((file) => ({ path: file.path, content: file.source })),
            modules: importantModules.map((module) => ({
              path: module.path,
              purpose: module.summary.purpose,
              responsibilities: module.summary.responsibilities.slice(0, 4),
              keyFlows: module.summary.keyFlows.slice(0, 2),
              dependencies: module.summary.dependencies.slice(0, 6),
              metrics: module.metric,
              evidence: module.summary.evidence?.slice(0, 2) ?? []
            })),
            internalEdges
          })
        }
      ]
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("The model returned an empty Big Picture");
    const parsed = projectOverviewSchema.parse(normalizeProjectOverviewCandidate(JSON.parse(raw)));
    const flow = parsed.flow.map((step) => ({ ...step, modulePaths: step.modulePaths.filter((modulePath) => modulePaths.has(modulePath)) }));
    const evidence = parsed.evidence
      .filter((item) => evidenceSources.has(item.filePath) && item.startLine <= item.endLine && item.startLine <= evidenceSources.get(item.filePath)!)
      .map((item) => ({ ...item, endLine: Math.min(item.endLine, evidenceSources.get(item.filePath)!) }));
    return { ...parsed, flow, evidence: evidence.length ? evidence : fallback.evidence, generatedBy: model };
  } catch (error) {
    throw llmFailure("The LLM could not produce the required Big Picture analysis", error);
  }
}

async function summarizeDiagramWithLlm(input: {
  overview: ProjectOverview;
  modules: AnalyzedModule[];
  edges: DependencyEdge[];
  sourceFiles: IndexedFile[];
  contextFiles: ProjectContextFile[];
}): Promise<RepositoryDiagram> {
  const apiKey = process.env.LLM_API_KEY ?? process.env.CKEY_API_KEY;
  if (!apiKey) throw new Error("Big Picture concept mapping requires LLM_API_KEY or CKEY_API_KEY");
  const model = configuredModel();
  try {
    const knownModulePaths = new Set(input.modules.map((module) => module.path));
    const evidenceSources = new Map([
      ...input.sourceFiles.map((file) => [file.path, file.lines] as const),
      ...input.contextFiles.map((file) => [file.path, file.lines] as const)
    ]);
    const importantModules = [...input.modules]
      .sort((a, b) => (b.metric.fanIn + b.metric.fanOut + b.metric.hotspotScore / 20) - (a.metric.fanIn + a.metric.fanOut + a.metric.hotspotScore / 20))
      .slice(0, 80);
    const internalEdges = input.edges.filter((edge) => knownModulePaths.has(edge.source) && knownModulePaths.has(edge.target)).slice(0, 240);
    const client = new OpenAI({ apiKey, baseURL: process.env.LLM_BASE_URL ?? process.env.CKEY_BASE_URL ?? "https://api.xah.io/v1" });
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You create small concept maps for people who do not know how software is built. Visualize the user, the problem or input they start with, the project's main action, and the useful outcome. Labels and descriptions must use ordinary product language, never filenames, modules, frameworks, infrastructure, or architecture jargon. Return only valid JSON matching the requested shape. Every concept must be supported by the supplied project context or source evidence; mark indirect interpretations as inferred."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Create a 3 to 7 node plain-language concept map that visually explains how this project's purpose connects a user's problem to an outcome. Use actor for the person, boundary for the problem or starting input, transform/service for the project's action, and artifact for the useful outcome. This will be rendered as a Mermaid flowchart in the Big Picture view.",
            shape: {
              description: "one plain-language sentence explaining the concept map",
              nodes: [{ id: "stable-slug", label: "two to five plain-language words", kind: "actor | service | transform | artifact | boundary", description: "one short nontechnical sentence", modulePaths: ["exact supplied module path used only as hidden evidence"], evidence: [{ filePath: "exact path", startLine: 1, endLine: 2, reason: "support" }], provenance: "observed | inferred", confidence: "low | medium | high" }],
              relationships: [{ id: "source-to-target", source: "node id", target: "node id", kind: "transforms | calls | publishes | reads | writes | depends-on", label: "short everyday verb phrase", evidence: [{ filePath: "exact path", startLine: 1, endLine: 2, reason: "support" }], provenance: "observed | inferred", confidence: "low | medium | high" }],
              generatedBy: "configured LLM model",
              confidence: "low | medium | high"
            },
            bigPicture: {
              summary: input.overview.summary,
              problem: input.overview.problem,
              outcome: input.overview.outcome,
              audience: input.overview.audience,
              capabilities: input.overview.capabilities
            },
            modules: importantModules.map((module) => ({ path: module.path, cluster: module.cluster, purpose: module.summary.purpose, responsibilities: module.summary.responsibilities.slice(0, 4), dependencies: module.summary.dependencies.slice(0, 6), metrics: module.metric, evidence: module.summary.evidence?.slice(0, 2) ?? [] })),
            internalEdges,
            projectFiles: input.contextFiles.map((file) => ({ path: file.path, content: file.source }))
          })
        }
      ]
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("The model returned an empty concept map");
    const parsed = repositoryDiagramSchema.parse(normalizeRepositoryDiagramCandidate(JSON.parse(raw)));
    const nodes = parsed.nodes.map((node) => {
      const modulePaths = node.modulePaths.filter((modulePath) => knownModulePaths.has(modulePath));
      const evidence = node.evidence.filter((item) => evidenceSources.has(item.filePath) && item.startLine <= item.endLine && item.startLine <= evidenceSources.get(item.filePath)!).map((item) => ({ ...item, endLine: Math.min(item.endLine, evidenceSources.get(item.filePath)!) }));
      return { ...node, modulePaths, evidence, provenance: node.provenance === "observed" && evidence.length ? "observed" as const : "inferred" as const };
    }).filter((node) => node.modulePaths.length > 0 || node.evidence.length > 0);
    if (nodes.length < 2) throw new Error("The model did not return enough evidence-backed concepts");
    const nodeIds = new Set(nodes.map((node) => node.id));
    const relationships = parsed.relationships.filter((relationship) => nodeIds.has(relationship.source) && nodeIds.has(relationship.target) && relationship.source !== relationship.target).map((relationship) => {
      const evidence = relationship.evidence.filter((item) => evidenceSources.has(item.filePath) && item.startLine <= item.endLine && item.startLine <= evidenceSources.get(item.filePath)!).map((item) => ({ ...item, endLine: Math.min(item.endLine, evidenceSources.get(item.filePath)!) }));
      return { ...relationship, evidence, provenance: relationship.provenance === "observed" && evidence.length ? "observed" as const : "inferred" as const };
    });
    return { ...parsed, nodes, relationships, generatedBy: model };
  } catch (error) {
    throw llmFailure("The LLM could not produce the required Big Picture concept map", error);
  }
}

async function summarizeSystemDesignWithLlm(input: {
  repositoryName: string;
  modules: AnalyzedModule[];
  edges: DependencyEdge[];
  sourceFiles: IndexedFile[];
  contextFiles: ProjectContextFile[];
}): Promise<RepositorySystemDesign> {
  const fallback = buildFallbackSystemDesign({
    repositoryName: input.repositoryName,
    modules: input.modules,
    edges: input.edges,
    contextFiles: input.contextFiles
  });
  const apiKey = process.env.LLM_API_KEY ?? process.env.CKEY_API_KEY;
  if (!apiKey) return fallback;
  const model = configuredModel();

  try {
    const knownModulePaths = new Set(input.modules.map((module) => module.path));
    const evidenceSources = new Map([
      ...input.sourceFiles.map((file) => [file.path, file.lines] as const),
      ...input.contextFiles.map((file) => [file.path, file.lines] as const)
    ]);
    const importantModules = [...input.modules]
      .sort((a, b) => (b.metric.fanIn + b.metric.fanOut + b.metric.hotspotScore / 20) - (a.metric.fanIn + a.metric.fanOut + a.metric.hotspotScore / 20))
      .slice(0, 100);
    const internalEdges = input.edges.filter((edge) => knownModulePaths.has(edge.source)).slice(0, 280);
    const client = new OpenAI({ apiKey, baseURL: process.env.LLM_BASE_URL ?? process.env.CKEY_BASE_URL ?? "https://api.xah.io/v1" });
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a careful software architect. Return only valid JSON matching the requested shape. Build a logical C4-style container view of the analyzed repository. Use only supplied source, module summaries, dependency edges, manifests, and architecture configuration. Never invent runtime behavior, deployment details, databases, queues, or external systems. Mark indirect interpretations as inferred."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Describe the repository's system design: logical containers, workers, stores, queues, actors, external systems, boundaries, and the relationships between them.",
            shape: {
              description: "one sentence explaining the logical system-design view",
              boundaries: [{ id: "system", label: "Analyzed system", description: "boundary description", kind: "system | external", evidence: [{ filePath: "exact path", startLine: 1, endLine: 2, reason: "support" }], provenance: "observed | inferred", confidence: "low | medium | high" }],
              nodes: [{ id: "stable-slug", label: "short element name", kind: "actor | container | worker | store | queue | external-system", description: "responsibility", technology: "optional technology", boundaryId: "known boundary id", modulePaths: ["exact supplied module path"], evidence: [{ filePath: "exact path", startLine: 1, endLine: 2, reason: "support" }], provenance: "observed | inferred", confidence: "low | medium | high" }],
              relationships: [{ id: "source-to-target", source: "node id", target: "node id", kind: "calls | publishes | reads | writes | depends-on", label: "short verb phrase", protocol: "optional protocol", evidence: [{ filePath: "exact path", startLine: 1, endLine: 2, reason: "support" }], provenance: "observed | inferred", confidence: "low | medium | high" }],
              generatedBy: "configured LLM model",
              confidence: "low | medium | high"
            },
            repositoryName: input.repositoryName,
            contextFiles: input.contextFiles.map((file) => ({ path: file.path, content: file.source })),
            modules: importantModules.map((module) => ({
              path: module.path,
              cluster: module.cluster,
              purpose: module.summary.purpose,
              responsibilities: module.summary.responsibilities.slice(0, 4),
              dependencies: module.summary.dependencies.slice(0, 8),
              metrics: module.metric,
              evidence: module.summary.evidence?.slice(0, 2) ?? []
            })),
            edges: internalEdges
          })
        }
      ]
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return fallback;
    const parsed = repositorySystemDesignSchema.parse(normalizeRepositorySystemDesignCandidate(JSON.parse(raw))) as RepositorySystemDesign;
    const normalized = normalizeSystemDesign(parsed, knownModulePaths, evidenceSources);
    if (normalized.boundaries.length < 1 || normalized.nodes.length < 2) return fallback;
    return { ...normalized, generatedBy: model };
  } catch {
    return fallback;
  }
}

export async function analyzeRepository(input: { repositoryUrl: string; id: string }, onProgress: Progress): Promise<AnalysisReport> {
  if (!(process.env.LLM_API_KEY ?? process.env.CKEY_API_KEY)) {
    throw new Error("An LLM API key is required to analyze a repository and explain its Big Picture");
  }
  configuredModel();
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "codebase-analyzer-"));
  try {
    onProgress("cloning", 12, "Cloning a detached snapshot");
    await execFileAsync("git", ["-c", "http.followRedirects=false", "clone", "--depth", "1", "--quiet", input.repositoryUrl, workspace], { timeout: 120_000 });
    const { stdout: sha } = await execFileAsync("git", ["-C", workspace, "rev-parse", "HEAD"], { timeout: 10_000 });
    const { stdout: branch } = await execFileAsync("git", ["-C", workspace, "branch", "--show-current"], { timeout: 10_000 });

    onProgress("indexing", 30, "Indexing source files and imports");
    const files = await listSourceFiles(workspace);
    const projectContext = await readProjectContext(workspace);
    if (!files.length) throw new Error("No analyzable text source files were found");
    const paths = new Set(files.map((file) => file.path));

    onProgress("graphing", 48, "Drawing the dependency graph");
    const rawEdges: DependencyEdge[] = [];
    for (const file of files) {
      for (const imported of importsFor(file)) {
        const target = resolveImport(file, imported.specifier, paths);
        rawEdges.push({ source: file.path, target: target ?? imported.specifier, kind: target ? imported.kind : "unresolved", line: imported.line });
      }
    }
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    for (const edge of rawEdges) {
      outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
      if (paths.has(edge.target)) inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }

    onProgress("scoring", 62, "Finding complexity hotspots");
    const modules: AnalyzedModule[] = files.map((file) => {
      const cluster = file.path.includes("/") ? file.path.split("/")[0] : "root";
      const metric = metricFor(file, inDegree.get(file.path) ?? 0, outDegree.get(file.path) ?? 0);
      return { id: crypto.createHash("sha1").update(file.path).digest("hex").slice(0, 10), path: file.path, language: file.language, cluster, metric, summary: fallbackSummary(file, metric, []) };
    });
    const moduleMap = new Map(modules.map((module) => [module.path, module]));

    const dependenciesBySource = new Map<string, string[]>();
    for (const edge of rawEdges) {
      const dependencies = dependenciesBySource.get(edge.source) ?? [];
      dependencies.push(edge.target);
      dependenciesBySource.set(edge.source, dependencies);
    }

    const configuredSummaryConcurrency = Number(process.env.LLM_CONCURRENCY ?? 4);
    const summaryConcurrency = Math.min(8, Math.max(1, Math.floor(configuredSummaryConcurrency) || 1));
    onProgress("summarizing", 76, `Reading project behavior across ${files.length} source files`);
    let completedSummaries = 0;
    let lastSummaryProgress = 75;
    await mapWithConcurrency(files, summaryConcurrency, async (file) => {
      const module = moduleMap.get(file.path)!;
      const dependencies = dependenciesBySource.get(file.path) ?? [];
      module.summary = await summarizeWithLlm(file, module.metric, dependencies);
      completedSummaries += 1;
      const summaryProgress = 76 + Math.floor((completedSummaries / files.length) * 17);
      if (summaryProgress > lastSummaryProgress) {
        onProgress("summarizing", summaryProgress, `Read ${completedSummaries} of ${files.length} source files`);
        lastSummaryProgress = summaryProgress;
      }
    });

    const repositoryName = input.repositoryUrl.split("/").slice(-2).join("/");
    const languages = [...new Set(files.map((file) => file.language))];
    onProgress("summarizing", 95, "Explaining the project's purpose and problem");
    const overview = await summarizeProjectWithLlm({ repositoryName, languages, modules, edges: rawEdges, sourceFiles: files, contextFiles: projectContext });
    onProgress("summarizing", 97, "Visualizing the project as a concept map");
    const diagram = await summarizeDiagramWithLlm({ overview, modules, edges: rawEdges, sourceFiles: files, contextFiles: projectContext });
    onProgress("summarizing", 98, "Synthesizing system design architecture");
    const systemDesign = await summarizeSystemDesignWithLlm({ repositoryName, modules, edges: rawEdges, sourceFiles: files, contextFiles: projectContext });

    const report: AnalysisReport = {
      id: input.id,
      shareToken: crypto.randomBytes(12).toString("base64url"),
      repositoryUrl: input.repositoryUrl,
      repositoryName,
      commitSha: sha.trim(),
      branch: branch.trim() || "default",
      analyzedAt: new Date().toISOString(),
      languages,
      totals: { files: files.length, lines: files.reduce((sum, file) => sum + file.lines, 0), modules: modules.length, edges: rawEdges.length },
      modules,
      edges: rawEdges,
      clusters: [...new Set(modules.map((module) => module.cluster))],
      overview,
      diagram,
      systemDesign
    };
    onProgress("completed", 100, "Report ready");
    return report;
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}
