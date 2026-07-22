import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import OpenAI from "openai";
import { parseJavaScriptImports } from "./ast";
import { mapWithConcurrency } from "./concurrency";
import { buildFallbackProjectOverview, buildFallbackRepositoryDiagram } from "./project-overview";
import { llmSummarySchema, projectOverviewSchema, repositoryDiagramSchema } from "./validation";
import type {
  AnalysisReport,
  AnalysisStage,
  AnalyzedModule,
  DependencyEdge,
  Language,
  ModuleMetric,
  ModuleSummary,
  ProjectOverview,
  RepositoryDiagram
} from "./types";

const execFileAsync = promisify(execFile);
const DEFAULT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"]);
const IGNORED = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", "vendor", "__pycache__"]);
const MAX_FILES = Number(process.env.ANALYZER_MAX_FILES ?? 10_000);
const MAX_BYTES = Number(process.env.ANALYZER_MAX_BYTES ?? 100 * 1024 * 1024);

type Progress = (stage: AnalysisStage, progress: number, message: string) => void;
type IndexedFile = { path: string; language: Language; source: string; lines: number };
type ProjectContextFile = { path: string; source: string; lines: number };

function languageFor(filePath: string): Language {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".ts" || extension === ".tsx") return "typescript";
  if (extension === ".js" || extension === ".jsx" || extension === ".mjs" || extension === ".cjs") return "javascript";
  if (extension === ".py") return "python";
  return "unknown";
}

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
      if (!entry.isFile() || !DEFAULT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      if (files.length >= MAX_FILES) throw new Error(`Repository exceeds the ${MAX_FILES.toLocaleString()} file limit`);
      const stat = await fs.stat(path.join(root, child));
      totalBytes += stat.size;
      if (totalBytes > MAX_BYTES) throw new Error("Repository exceeds the 100 MB source limit");
      const source = await fs.readFile(path.join(root, child), "utf8");
      files.push({ path: child.split(path.sep).join("/"), language: languageFor(child), source, lines: source.split(/\r?\n/).length });
    }
  }

  await visit("");
  return files;
}

async function readProjectContext(root: string): Promise<ProjectContextFile[]> {
  const rootEntries = await fs.readdir(root, { withFileTypes: true });
  const names = rootEntries
    .filter((entry) => entry.isFile() && (/^readme(?:\.[^.]+)?$/i.test(entry.name) || /^(package\.json|pyproject\.toml|cargo\.toml|go\.mod)$/i.test(entry.name)))
    .map((entry) => entry.name)
    .slice(0, 4);
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
  try {
    const client = new OpenAI({ apiKey, baseURL: process.env.LLM_BASE_URL ?? process.env.CKEY_BASE_URL ?? "https://api.xah.io/v1" });
    const response = await client.chat.completions.create({
      model: process.env.LLM_MODEL ?? "deepseek-v4-flash",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a careful code archaeologist. Return only valid JSON matching the requested shape. Describe observed behavior, mark uncertainty, and never invent APIs." },
        {
          role: "user",
          content: JSON.stringify({
            task: "Explain one source module for an architecture report.",
            shape: { modulePath: "string", purpose: "string", responsibilities: ["string"], keyFlows: ["string"], dependencies: ["string"], risks: ["string"], confidence: "low | medium | high", evidence: [{ filePath: "string", startLine: "number", endLine: "number", reason: "string" }] },
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
    return { ...parsed, evidence: evidence.length ? evidence : fallback.evidence, generatedBy: "deepseek-v4-flash" };
  } catch {
    return fallback;
  }
}

async function summarizeProjectWithLlm(input: {
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
  if (!apiKey) return fallback;

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
      model: process.env.LLM_MODEL ?? "deepseek-v4-flash",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a careful software architect. Explain the analyzed repository itself, not the analysis tool. Return only valid JSON matching the requested shape. Base every claim on the supplied README, manifests, module summaries, and dependency edges. Never invent features." },
        {
          role: "user",
          content: JSON.stringify({
            task: "Create a concise project-level explanation and a 3 to 6 step system flow for an engineer seeing this repository for the first time.",
            shape: {
              summary: "plain-language description of what the project does and why it exists",
              audience: ["primary user or integrating system"],
              capabilities: ["concrete user-visible or system capability"],
              flow: [{ title: "short stage name", description: "what happens in this stage", modulePaths: ["exact supplied module path"] }],
              risks: ["project-level engineering risk"],
              confidence: "low | medium | high",
              evidence: [{ filePath: "exact supplied path", startLine: "number", endLine: "number", reason: "claim supported by this location" }]
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
    if (!raw) return fallback;
    const parsed = projectOverviewSchema.parse(JSON.parse(raw));
    const flow = parsed.flow.map((step) => ({ ...step, modulePaths: step.modulePaths.filter((modulePath) => modulePaths.has(modulePath)) }));
    const evidence = parsed.evidence
      .filter((item) => evidenceSources.has(item.filePath) && item.startLine <= item.endLine && item.startLine <= evidenceSources.get(item.filePath)!)
      .map((item) => ({ ...item, endLine: Math.min(item.endLine, evidenceSources.get(item.filePath)!) }));
    return { ...parsed, flow, evidence: evidence.length ? evidence : fallback.evidence, generatedBy: "deepseek-v4-flash" };
  } catch {
    return fallback;
  }
}

async function summarizeDiagramWithLlm(input: {
  modules: AnalyzedModule[];
  edges: DependencyEdge[];
  sourceFiles: IndexedFile[];
  contextFiles: ProjectContextFile[];
}): Promise<RepositoryDiagram> {
  const fallback = buildFallbackRepositoryDiagram({ modules: input.modules, edges: input.edges });
  const apiKey = process.env.LLM_API_KEY ?? process.env.CKEY_API_KEY;
  if (!apiKey) return fallback;
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
      model: process.env.LLM_MODEL ?? "deepseek-v4-flash",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a careful software architect. Return only valid JSON matching the requested shape. Group source modules into a small, readable semantic data-flow diagram. Never invent a database, actor, service, artifact, transformation, or relationship that is not supported by the supplied evidence. Use inferred provenance when the evidence is indirect." },
        {
          role: "user",
          content: JSON.stringify({
            task: "Create a semantic data-flow architecture diagram for an unfamiliar repository.",
            shape: {
              description: "one sentence explaining the diagram's scope",
              nodes: [{ id: "stable-slug", label: "short node name", kind: "actor | service | worker | store | artifact | transform | boundary", description: "what this area does", modulePaths: ["exact supplied module path"], evidence: [{ filePath: "exact path", startLine: "number", endLine: "number", reason: "support" }], provenance: "observed | inferred", confidence: "low | medium | high" }],
              relationships: [{ id: "source-to-target", source: "node id", target: "node id", kind: "depends-on | reads | writes | transforms | publishes | calls", label: "short verb phrase", evidence: [{ filePath: "exact path", startLine: "number", endLine: "number", reason: "support" }], provenance: "observed | inferred", confidence: "low | medium | high" }],
              generatedBy: "deepseek-v4-flash",
              confidence: "low | medium | high"
            },
            modules: importantModules.map((module) => ({ path: module.path, cluster: module.cluster, purpose: module.summary.purpose, responsibilities: module.summary.responsibilities.slice(0, 4), dependencies: module.summary.dependencies.slice(0, 6), metrics: module.metric, evidence: module.summary.evidence?.slice(0, 2) ?? [] })),
            internalEdges,
            projectFiles: input.contextFiles.map((file) => ({ path: file.path, content: file.source }))
          })
        }
      ]
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return fallback;
    const parsed = repositoryDiagramSchema.parse(JSON.parse(raw));
    const nodes = parsed.nodes.map((node) => {
      const modulePaths = node.modulePaths.filter((modulePath) => knownModulePaths.has(modulePath));
      const evidence = node.evidence.filter((item) => evidenceSources.has(item.filePath) && item.startLine <= item.endLine && item.startLine <= evidenceSources.get(item.filePath)!).map((item) => ({ ...item, endLine: Math.min(item.endLine, evidenceSources.get(item.filePath)!) }));
      return { ...node, modulePaths, evidence, provenance: node.provenance === "observed" && evidence.length ? "observed" as const : "inferred" as const };
    }).filter((node) => node.modulePaths.length > 0);
    if (nodes.length < 2) return fallback;
    const nodeIds = new Set(nodes.map((node) => node.id));
    const relationships = parsed.relationships.filter((relationship) => nodeIds.has(relationship.source) && nodeIds.has(relationship.target) && relationship.source !== relationship.target).map((relationship) => {
      const evidence = relationship.evidence.filter((item) => evidenceSources.has(item.filePath) && item.startLine <= item.endLine && item.startLine <= evidenceSources.get(item.filePath)!).map((item) => ({ ...item, endLine: Math.min(item.endLine, evidenceSources.get(item.filePath)!) }));
      return { ...relationship, evidence, provenance: relationship.provenance === "observed" && evidence.length ? "observed" as const : "inferred" as const };
    });
    return { ...parsed, nodes, relationships, generatedBy: "deepseek-v4-flash" };
  } catch {
    return fallback;
  }
}

export async function analyzeRepository(input: { repositoryUrl: string; id: string }, onProgress: Progress): Promise<AnalysisReport> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "codebase-analyzer-"));
  try {
    onProgress("cloning", 12, "Cloning a detached snapshot");
    await execFileAsync("git", ["-c", "http.followRedirects=false", "clone", "--depth", "1", "--quiet", input.repositoryUrl, workspace], { timeout: 120_000 });
    const { stdout: sha } = await execFileAsync("git", ["-C", workspace, "rev-parse", "HEAD"], { timeout: 10_000 });
    const { stdout: branch } = await execFileAsync("git", ["-C", workspace, "branch", "--show-current"], { timeout: 10_000 });

    onProgress("indexing", 30, "Indexing source files and imports");
    const files = await listSourceFiles(workspace);
    const projectContext = await readProjectContext(workspace);
    if (!files.length) throw new Error("No JS, TS, or Python source files were found");
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
    onProgress("summarizing", 76, `Explaining ${files.length} modules with ${summaryConcurrency} workers`);
    let completedSummaries = 0;
    let lastSummaryProgress = 75;
    await mapWithConcurrency(files, summaryConcurrency, async (file) => {
      const module = moduleMap.get(file.path)!;
      const dependencies = dependenciesBySource.get(file.path) ?? [];
      module.summary = await summarizeWithLlm(file, module.metric, dependencies);
      completedSummaries += 1;
      const summaryProgress = 76 + Math.floor((completedSummaries / files.length) * 17);
      if (summaryProgress > lastSummaryProgress) {
        onProgress("summarizing", summaryProgress, `Explained ${completedSummaries} of ${files.length} modules`);
        lastSummaryProgress = summaryProgress;
      }
    });

    const repositoryName = input.repositoryUrl.split("/").slice(-2).join("/");
    const languages = [...new Set(files.map((file) => file.language))];
    onProgress("summarizing", 95, "Synthesizing the project big picture");
    const overview = await summarizeProjectWithLlm({ repositoryName, languages, modules, edges: rawEdges, sourceFiles: files, contextFiles: projectContext });
    onProgress("summarizing", 97, "Mapping semantic architecture nodes");
    const diagram = await summarizeDiagramWithLlm({ modules, edges: rawEdges, sourceFiles: files, contextFiles: projectContext });

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
      diagram
    };
    onProgress("completed", 100, "Report ready");
    return report;
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}
