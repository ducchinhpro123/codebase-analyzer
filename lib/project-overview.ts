import type { AnalysisReport, AnalyzedModule, DependencyEdge, DiagramNode, DiagramNodeKind, DiagramRelationship, Evidence, Language, ProjectFlowStep, ProjectOverview, RepositoryDiagram } from "./types";
import { buildFallbackSystemDesign, isFileLevelSystemDesign } from "./system-design";

type OverviewInput = {
  repositoryName: string;
  languages: Language[];
  modules: AnalyzedModule[];
  readmeSummary?: string;
};

type DiagramInput = {
  modules: AnalyzedModule[];
  edges: DependencyEdge[];
};

function uniquePaths(modules: AnalyzedModule[]) {
  return [...new Set(modules.map((module) => module.path))].slice(0, 4);
}

function flowStep(title: string, description: string, modules: AnalyzedModule[]): ProjectFlowStep {
  return { title, description, modulePaths: uniquePaths(modules) };
}

function isMeaningfulPurpose(purpose: string) {
  return purpose.length >= 32 && !/^The [\w -]+ module\.?$/i.test(purpose.trim());
}

function diagramId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "node";
}

function mermaidText(value: string, maxLength = 120) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/[<>]/g, "")
    .replace(/[{}[\]|]/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function mermaidNodeId(value: string) {
  return `concept_${diagramId(value).replace(/-/g, "_")}`;
}

function kindForModules(cluster: string, modules: AnalyzedModule[]): DiagramNodeKind {
  const text = `${cluster} ${modules.map((module) => `${module.path} ${module.summary.purpose}`).join(" ")}`.toLowerCase();
  if (/test|spec/.test(text)) return "boundary";
  if (/queue|worker|job|consumer/.test(text)) return "worker";
  if (/database|db|store|persist|cache|sql|redis/.test(text)) return "store";
  if (/parse|pipeline|process|analy|transform|crypt|filter|classif/.test(text)) return "transform";
  if (/cli|client|user|frontend|web|api|server|app|route/.test(text)) return "service";
  if (/type|schema|model|document|artifact|output/.test(text)) return "artifact";
  return "service";
}

function nodeDescription(modules: AnalyzedModule[]) {
  return modules.map((module) => module.summary.purpose.trim()).filter(isMeaningfulPurpose).slice(0, 2).join(" ") || "Semantic area inferred from the analyzed module structure.";
}

function evidenceForModule(module: AnalyzedModule): Evidence[] {
  return (module.summary.evidence ?? []).slice(0, 2);
}

export function buildFallbackRepositoryDiagram({ modules, edges }: DiagramInput): RepositoryDiagram {
  const production = modules.filter((module) => !/(^|\/)(__tests__|tests?|spec)(\/|\.|$)/i.test(module.path));
  const source = production.length >= 2 ? production : modules;
  const groups = new Map<string, AnalyzedModule[]>();
  for (const module of source) {
    const cluster = module.cluster || "root";
    groups.set(cluster, [...(groups.get(cluster) ?? []), module]);
  }
  let grouped = [...groups.entries()];
  if (grouped.length < 2) grouped = [...source].sort((a, b) => b.metric.fanOut - a.metric.fanOut).slice(0, 8).map((module) => [module.path, [module]]);
  const nodes: DiagramNode[] = grouped.slice(0, 12).map(([cluster, group]) => ({
    id: `node-${diagramId(cluster)}`,
    label: cluster.split(/[\\/]/).at(-1)?.replace(/[-_]/g, " ") || "Root",
    kind: kindForModules(cluster, group),
    description: nodeDescription(group),
    modulePaths: group.map((module) => module.path).slice(0, 8),
    evidence: group.flatMap(evidenceForModule).slice(0, 4),
    provenance: "observed",
    confidence: "medium"
  }));
  const moduleNode = new Map(nodes.flatMap((node) => node.modulePaths.map((modulePath) => [modulePath, node.id] as const)));
  const relationshipMap = new Map<string, DiagramRelationship>();
  for (const edge of edges) {
    const source = moduleNode.get(edge.source);
    const target = moduleNode.get(edge.target);
    if (!source || !target || source === target) continue;
    const id = `${source}->${target}`;
    if (relationshipMap.has(id)) continue;
    const sourceModule = modules.find((module) => module.path === edge.source);
    relationshipMap.set(id, {
      id,
      source,
      target,
      kind: "depends-on",
      label: "depends on",
      evidence: sourceModule?.summary.evidence?.slice(0, 1) ?? [],
      provenance: "observed",
      confidence: "high"
    });
  }
  const relationships = [...relationshipMap.values()];
  if (!relationships.length) {
    for (let index = 0; index < nodes.length - 1; index += 1) relationships.push({ id: `${nodes[index].id}->${nodes[index + 1].id}`, source: nodes[index].id, target: nodes[index + 1].id, kind: "depends-on", label: "likely path", evidence: [], provenance: "inferred", confidence: "low" });
  }
  return { description: "Semantic areas grouped from the repository structure and linked by observed or inferred dependencies.", nodes, relationships, generatedBy: "deterministic-fallback", confidence: "medium" };
}

export function buildFallbackProjectOverview({ repositoryName, languages, modules, readmeSummary }: OverviewInput): ProjectOverview {
  const productionModules = modules.filter((module) => !/(^|\/)(__tests__|tests?|spec)(\/|\.|$)/i.test(module.path));
  const relevant = productionModules.length ? productionModules : modules;
  const byFanOut = [...relevant].sort((a, b) => b.metric.fanOut - a.metric.fanOut || b.metric.hotspotScore - a.metric.hotspotScore);
  const byCentrality = [...relevant].sort((a, b) => (b.metric.fanIn + b.metric.fanOut) - (a.metric.fanIn + a.metric.fanOut) || b.metric.hotspotScore - a.metric.hotspotScore);
  const entryPoints = byFanOut.filter((module) => module.metric.fanIn === 0 || /(^|\/)(__main__|main|index|app|cli|server|web)\.[^.]+$/i.test(module.path)).slice(0, 4);
  const orchestrators = byFanOut.slice(0, 4);
  const core = byCentrality.slice(0, 4);
  const boundaries = relevant.filter((module) => module.metric.fanOut === 0 && module.metric.fanIn > 0).sort((a, b) => b.metric.fanIn - a.metric.fanIn).slice(0, 4);
  const central = byCentrality[0];
  const languageLabel = languages.filter((language) => language !== "unknown").join(" and ") || "source code";
  const purposeSummary = byCentrality.map((module) => module.summary.purpose.trim()).filter(isMeaningfulPurpose).filter((purpose, index, all) => all.indexOf(purpose) === index).slice(0, 3).join(" ");
  const summary = readmeSummary ?? (purposeSummary || (central
    ? `${repositoryName} is a ${languageLabel} project with ${modules.length} analyzed modules. Its most connected implementation centers on ${central.path}.`
    : `${repositoryName} is a ${languageLabel} project.`));
  const capabilities = byCentrality.map((module) => module.summary.purpose).filter(isMeaningfulPurpose).filter((purpose, index, all) => all.indexOf(purpose) === index).slice(0, 4);
  const risks = [...relevant].sort((a, b) => b.metric.hotspotScore - a.metric.hotspotScore).flatMap((module) => module.summary.risks).filter((risk, index, all) => all.indexOf(risk) === index).slice(0, 3);
  const evidence = byCentrality.flatMap((module) => module.summary.evidence ?? []).slice(0, 4);
  const flow = [
    flowStep("Entry points", "Commands, requests, or application startup enter the system here.", entryPoints.length ? entryPoints : byFanOut.slice(0, 3)),
    flowStep("Orchestration", "Coordinator modules validate input and direct work into the main pipeline.", orchestrators),
    flowStep("Core processing", "The most connected modules perform the repository's central work.", core),
    flowStep("Outputs and boundaries", "Leaf modules return results or connect the project to external systems.", boundaries.length ? boundaries : [...relevant].reverse().slice(0, 3))
  ];

  return {
    summary,
    problem: "The specific user problem could not be established without an AI-generated reading of the repository context.",
    outcome: capabilities.length
      ? capabilities[0]
      : "It organizes the available source into a project that can be inspected and understood.",
    audience: [],
    capabilities: capabilities.length ? capabilities : ["Organizes the analyzed source modules into an executable system."],
    flow,
    risks,
    confidence: "low",
    generatedBy: "deterministic-fallback",
    evidence
  };
}

export function repositoryDiagramToMermaid(diagram: RepositoryDiagram) {
  const nodeIds = new Map(diagram.nodes.map((node) => [node.id, mermaidNodeId(node.id)]));
  const lines = ["flowchart LR"];

  for (const node of diagram.nodes) {
    const id = nodeIds.get(node.id)!;
    const label = `<b>${mermaidText(node.label, 52)}</b><br/>${mermaidText(node.description, 100)}`;
    if (node.kind === "actor") lines.push(`  ${id}(["${label}"]):::person`);
    else if (node.kind === "artifact") lines.push(`  ${id}[/"${label}"/]:::outcome`);
    else if (node.kind === "boundary") lines.push(`  ${id}{{"${label}"}}:::problem`);
    else lines.push(`  ${id}["${label}"]:::concept`);
  }

  for (const relationship of diagram.relationships) {
    const source = nodeIds.get(relationship.source);
    const target = nodeIds.get(relationship.target);
    if (!source || !target || source === target) continue;
    lines.push(`  ${source} -->|"${mermaidText(relationship.label, 64)}"| ${target}`);
  }

  lines.push("  classDef person fill:#20251b,stroke:#c7ff3d,color:#f2f1ec,stroke-width:2px");
  lines.push("  classDef problem fill:#251d1b,stroke:#e18b73,color:#f2f1ec,stroke-width:1.5px");
  lines.push("  classDef concept fill:#171d20,stroke:#71808a,color:#f2f1ec,stroke-width:1.5px");
  lines.push("  classDef outcome fill:#18241e,stroke:#72b58b,color:#f2f1ec,stroke-width:1.5px");
  return lines.join("\n");
}

export function normalizeReportOverview(report: AnalysisReport): AnalysisReport {
  const systemDesign = report.systemDesign && !isFileLevelSystemDesign(report.systemDesign)
    ? report.systemDesign
    : buildFallbackSystemDesign({ repositoryName: report.repositoryName, modules: report.modules, edges: report.edges });
  const fallbackOverview = () => buildFallbackProjectOverview({ repositoryName: report.repositoryName, languages: report.languages, modules: report.modules });
  const overview = report.overview?.problem && report.overview.outcome
    ? report.overview
    : report.overview
    ? {
        ...report.overview,
        problem: report.overview.problem || "The project addresses the need described in its repository context.",
        outcome: report.overview.outcome || report.overview.capabilities[0] || report.overview.summary
      }
    : fallbackOverview();
  if (report.overview === overview && report.diagram && systemDesign === report.systemDesign) return report;
  return {
    ...report,
    overview,
    diagram: report.diagram ?? buildFallbackRepositoryDiagram({ modules: report.modules, edges: report.edges }),
    systemDesign
  };
}
