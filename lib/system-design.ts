import type {
  AnalyzedModule,
  DependencyEdge,
  Evidence,
  RepositoryDiagram,
  RepositorySystemDesign,
  SystemDesignBoundary,
  SystemDesignNode,
  SystemDesignNodeKind,
  SystemDesignRelationship
} from "./types";

export type ArchitectureContextFile = {
  path: string;
  source: string;
  lines: number;
};

type SystemDesignInput = {
  repositoryName: string;
  modules: AnalyzedModule[];
  edges: DependencyEdge[];
  contextFiles?: ArchitectureContextFile[];
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "node";
}

function evidenceFor(module: AnalyzedModule | undefined): Evidence[] {
  return module?.summary.evidence?.slice(0, 2) ?? [];
}

function lineFor(source: string, pattern: RegExp) {
  const match = source.match(pattern);
  return match?.index === undefined ? 1 : source.slice(0, match.index).split(/\r?\n/).length;
}

function contextEvidence(file: ArchitectureContextFile, reason: string): Evidence {
  return { filePath: file.path, startLine: 1, endLine: Math.min(file.lines, 24), reason };
}

function kindForCluster(cluster: string, modules: AnalyzedModule[]): SystemDesignNodeKind {
  const text = `${cluster} ${modules.map((module) => `${module.path} ${module.summary.purpose}`).join(" ")}`.toLowerCase();
  if (/queue|kafka|rabbit|bull|pubsub/.test(text)) return "queue";
  if (/worker|job|consumer|background/.test(text)) return "worker";
  if (/redis|postgres|mysql|mongo|database|db|store|persist|cache|sql/.test(text)) return "store";
  return "container";
}

type LogicalGroup = {
  key: string;
  label: string;
  kind: SystemDesignNodeKind;
  modules: AnalyzedModule[];
};

function logicalRole(module: AnalyzedModule) {
  const text = `${module.path} ${module.summary.purpose} ${module.summary.responsibilities.join(" ")}`.toLowerCase();
  if (/(^|\/)(web|server|api)(\.|\/)|http|web app|web adapter|api route|route handler/.test(text)) return { key: "web-api", label: "Web / API application", kind: "container" as const };
  if (/(^|\/)(__main__|main|cli)(\.|\/)|command-line|command line|\bcli\b/.test(text)) return { key: "cli", label: "CLI application", kind: "container" as const };
  if (/queue|kafka|rabbit|bull|pubsub/.test(text)) return { key: "queue", label: "Message queue", kind: "queue" as const };
  if (/worker|job|consumer|background/.test(text)) return { key: "worker", label: "Background worker", kind: "worker" as const };
  if (/redis|postgres|mysql|mongo|database|\bdb\b|store|persist|cache|\bsql\b/.test(text)) return { key: "store", label: "Data store", kind: "store" as const };
  if (module.cluster && module.cluster !== "root") return { key: `cluster-${module.cluster}`, label: module.cluster.replace(/[-_]/g, " "), kind: kindForCluster(module.cluster, [module]) };
  return { key: "application-core", label: "Application core", kind: "container" as const };
}

function groupLogicalContainers(modules: AnalyzedModule[]): LogicalGroup[] {
  const groups = new Map<string, LogicalGroup>();
  for (const module of modules) {
    const role = logicalRole(module);
    const existing = groups.get(role.key);
    if (existing) existing.modules.push(module);
    else groups.set(role.key, { ...role, modules: [module] });
  }
  return [...groups.values()];
}

function technologyFor(text: string) {
  const match = text.match(/\b(next\.?js|react|node\.?js|express|fastapi|django|flask|postgres(?:ql)?|mysql|mongodb|redis|kafka|rabbitmq|bullmq|python|typescript|javascript)\b/i);
  return match?.[1];
}

function externalKind(name: string): SystemDesignNodeKind {
  if (/redis|postgres|mysql|mongo|sql|database|db|cache/.test(name)) return "store";
  if (/queue|kafka|rabbit|bull|pubsub/.test(name)) return "queue";
  return "external-system";
}

function externalCandidate(specifier: string) {
  const name = specifier.replace(/^@/, "").split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/");
  return /openai|anthropic|stripe|github|aws|azure|gcp|redis|postgres|mysql|mongo|kafka|rabbit|bull|queue|s3|sendgrid|twilio/i.test(name) ? name : undefined;
}

function composeServices(contextFiles: ArchitectureContextFile[]) {
  const services: { name: string; file: ArchitectureContextFile; line: number }[] = [];
  for (const file of contextFiles) {
    if (!/docker-compose|compose\.ya?ml$/i.test(file.path)) continue;
    for (const match of file.source.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)) {
      const name = match[1];
      if (name === "services" || name === "volumes" || name === "networks" || name === "version") continue;
      services.push({ name, file, line: lineFor(file.source, new RegExp(`^ {2}${name}:`, "m")) });
    }
  }
  return services;
}

function buildBoundaries(contextFiles: ArchitectureContextFile[]): SystemDesignBoundary[] {
  const systemEvidence = contextFiles.length ? [contextEvidence(contextFiles[0], "Repository context used to establish the analyzed software-system boundary.")] : [];
  return [
    {
      id: "system",
      label: "Analyzed system",
      description: "Logical containers and supporting modules owned by the repository.",
      kind: "system",
      evidence: systemEvidence,
      provenance: systemEvidence.length ? "observed" : "inferred",
      confidence: systemEvidence.length ? "medium" : "low"
    },
    {
      id: "external",
      label: "External systems",
      description: "Services, stores, and integrations outside the repository boundary.",
      kind: "external",
      evidence: [],
      provenance: "inferred",
      confidence: "low"
    }
  ];
}

export function buildFallbackSystemDesign(input: SystemDesignInput): RepositorySystemDesign {
  const production = input.modules.filter((module) => !/(^|\/)(__tests__|tests?|spec)(\/|\.|$)/i.test(module.path));
  const source = production.length >= 2 ? production : input.modules;
  const grouped = groupLogicalContainers(source);

  const boundaries = buildBoundaries(input.contextFiles ?? []);
  const nodes: SystemDesignNode[] = grouped.slice(0, 12).map((group) => {
    const text = `${group.label} ${group.modules.map((module) => `${module.path} ${module.summary.purpose}`).join(" ")}`;
    return {
      id: `container-${slug(group.key)}`,
      label: group.label,
      kind: group.kind,
      description: group.modules.map((module) => module.summary.purpose.trim()).filter(Boolean).slice(0, 2).join(" ") || "Logical container inferred from the repository structure.",
      technology: technologyFor(text),
      boundaryId: "system",
      modulePaths: group.modules.map((module) => module.path).slice(0, 8),
      evidence: group.modules.flatMap(evidenceFor).slice(0, 4),
      provenance: "observed",
      confidence: "medium"
    };
  });

  const moduleNode = new Map(nodes.flatMap((node) => node.modulePaths.map((modulePath) => [modulePath, node.id] as const)));
  const externalNodes = new Map<string, SystemDesignNode>();
  for (const edge of input.edges) {
    if (moduleNode.has(edge.target) || edge.target.startsWith(".")) continue;
    const candidate = externalCandidate(edge.target);
    if (!candidate || externalNodes.has(candidate)) continue;
    const sourceModule = input.modules.find((module) => module.path === edge.source);
    externalNodes.set(candidate, {
      id: `external-${slug(candidate)}`,
      label: candidate,
      kind: externalKind(candidate.toLowerCase()),
      description: `External dependency referenced by ${sourceModule?.path ?? "repository source"}.`,
      technology: candidate,
      boundaryId: "external",
      modulePaths: sourceModule ? [sourceModule.path] : [],
      evidence: evidenceFor(sourceModule),
      provenance: "observed",
      confidence: "medium"
    });
  }

  for (const service of composeServices(input.contextFiles ?? [])) {
    const id = `external-${slug(service.name)}`;
    if (externalNodes.has(service.name) || nodes.some((node) => node.id === id)) continue;
    externalNodes.set(service.name, {
      id,
      label: service.name,
      kind: externalKind(service.name.toLowerCase()),
      description: `Compose service declared in ${service.file.path}.`,
      technology: service.name,
      boundaryId: "external",
      modulePaths: [],
      evidence: [{ filePath: service.file.path, startLine: service.line, endLine: Math.min(service.file.lines, service.line + 10), reason: "Declares a runtime service in the repository's Compose configuration." }],
      provenance: "observed",
      confidence: "high"
    });
  }
  nodes.push(...externalNodes.values());

  const relationshipsById = new Map<string, SystemDesignRelationship>();
  for (const edge of input.edges) {
    const source = moduleNode.get(edge.source);
    const target = moduleNode.get(edge.target) ?? externalNodes.get(edge.target)?.id ?? externalNodes.get(edge.target.split("/").slice(0, 2).join("/"))?.id;
    if (!source || !target || source === target) continue;
    const sourceModule = input.modules.find((module) => module.path === edge.source);
    const external = target.startsWith("external-");
    const id = `${source}->${target}`;
    if (relationshipsById.has(id)) continue;
    relationshipsById.set(id, {
      id,
      source,
      target,
      kind: external ? "calls" : "depends-on",
      label: external ? "uses integration" : "depends on",
      evidence: evidenceFor(sourceModule),
      provenance: "observed",
      confidence: "high"
    });
  }

  return {
    description: `${input.repositoryName} represented as a logical C4-style container view inferred from source structure, manifests, and architecture configuration.`,
    boundaries,
    nodes,
    relationships: [...relationshipsById.values()],
    generatedBy: "deterministic-fallback",
    confidence: nodes.length >= 2 ? "medium" : "low"
  };
}

export function normalizeSystemDesign(
  design: RepositorySystemDesign,
  knownModulePaths: Set<string>,
  evidenceSources: Map<string, number>
) {
  const boundaries = design.boundaries.filter((boundary, index, all) => boundary.id && all.findIndex((item) => item.id === boundary.id) === index).map((boundary) => {
    const evidence = boundary.evidence.filter((item) => evidenceSources.has(item.filePath) && item.startLine <= item.endLine && item.startLine <= evidenceSources.get(item.filePath)!).map((item) => ({ ...item, endLine: Math.min(item.endLine, evidenceSources.get(item.filePath)!) }));
    return { ...boundary, evidence, provenance: boundary.provenance === "observed" && evidence.length ? "observed" as const : "inferred" as const };
  });
  const boundaryIds = new Set(boundaries.map((boundary) => boundary.id));
  const nodes = design.nodes.map((node) => {
    const modulePaths = node.modulePaths.filter((modulePath) => knownModulePaths.has(modulePath));
    const evidence = node.evidence.filter((item) => evidenceSources.has(item.filePath) && item.startLine <= item.endLine && item.startLine <= evidenceSources.get(item.filePath)!).map((item) => ({ ...item, endLine: Math.min(item.endLine, evidenceSources.get(item.filePath)!) }));
    return { ...node, modulePaths, evidence, provenance: node.provenance === "observed" && evidence.length ? "observed" as const : "inferred" as const };
  }).filter((node, index, all) => boundaryIds.has(node.boundaryId) && (node.modulePaths.length > 0 || node.evidence.length > 0) && all.findIndex((item) => item.id === node.id) === index);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const relationships = design.relationships.filter((relationship) => nodeIds.has(relationship.source) && nodeIds.has(relationship.target) && relationship.source !== relationship.target).map((relationship) => {
    const evidence = relationship.evidence.filter((item) => evidenceSources.has(item.filePath) && item.startLine <= item.endLine && item.startLine <= evidenceSources.get(item.filePath)!).map((item) => ({ ...item, endLine: Math.min(item.endLine, evidenceSources.get(item.filePath)!) }));
    return { ...relationship, evidence, provenance: relationship.provenance === "observed" && evidence.length ? "observed" as const : "inferred" as const };
  });
  return { ...design, boundaries, nodes, relationships };
}

export function systemDesignToDiagram(design: RepositorySystemDesign): RepositoryDiagram {
  const boundaryById = new Map(design.boundaries.map((boundary) => [boundary.id, boundary]));
  return {
    description: design.description,
    nodes: design.nodes.map((node) => {
      const boundary = boundaryById.get(node.boundaryId);
      return {
        id: node.id,
        label: node.label,
        kind: node.kind,
        description: `${boundary ? `${boundary.label}: ` : ""}${node.description}${node.technology ? ` Technology: ${node.technology}.` : ""}`,
        modulePaths: node.modulePaths,
        evidence: node.evidence,
        provenance: node.provenance,
        confidence: node.confidence
      };
    }),
    relationships: design.relationships.map((relationship) => ({
      id: relationship.id,
      source: relationship.source,
      target: relationship.target,
      kind: relationship.kind,
      label: relationship.protocol ? `${relationship.label} (${relationship.protocol})` : relationship.label,
      evidence: relationship.evidence,
      provenance: relationship.provenance,
      confidence: relationship.confidence
    })),
    generatedBy: design.generatedBy,
    confidence: design.confidence
  };
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
  return `sd_${slug(value).replace(/-/g, "_")}`;
}

export function systemDesignToMermaid(design: RepositorySystemDesign) {
  const nodeId = new Map(design.nodes.map((node) => [node.id, mermaidNodeId(node.id)]));
  const nodesByBoundary = new Map(design.boundaries.map((boundary) => [boundary.id, design.nodes.filter((node) => node.boundaryId === boundary.id)]));
  const lines = ["flowchart LR"];

  for (const boundary of design.boundaries) {
    const nodes = nodesByBoundary.get(boundary.id) ?? [];
    if (!nodes.length) continue;
    lines.push(`  subgraph ${mermaidNodeId(`boundary-${boundary.id}`)}["${mermaidText(boundary.label)}"]`);
    lines.push("    direction TB");
    for (const node of nodes) {
      const id = nodeId.get(node.id)!;
      const technology = node.technology ? `<br/><span class='technology'>${mermaidText(node.technology, 48)}</span>` : "";
      const description = mermaidText(node.description, 96);
      const label = `<b>${mermaidText(node.label, 52)}</b>${technology}<br/>${description}`;
      if (node.kind === "store") lines.push(`    ${id}[("${label}")]:::store`);
      else if (node.kind === "queue") lines.push(`    ${id}{{"${label}"}}:::queue`);
      else if (node.kind === "actor") lines.push(`    ${id}(["${label}"]):::actor`);
      else lines.push(`    ${id}["${label}"]:::${node.kind === "external-system" ? "external" : node.kind}`);
    }
    lines.push("  end");
  }

  for (const relationship of design.relationships) {
    const source = nodeId.get(relationship.source);
    const target = nodeId.get(relationship.target);
    if (!source || !target || source === target) continue;
    const protocol = relationship.protocol ? ` · ${relationship.protocol}` : "";
    lines.push(`  ${source} -->|"${mermaidText(`${relationship.label}${protocol}`, 72)}"| ${target}`);
  }

  lines.push("  classDef container fill:#f1f3ef,stroke:#14505c,color:#15201e,stroke-width:1.5px");
  lines.push("  classDef worker fill:#e8eeea,stroke:#4a6152,color:#15201e,stroke-width:1.5px");
  lines.push("  classDef store fill:#dbe7e9,stroke:#14505c,color:#15201e,stroke-width:1.5px");
  lines.push("  classDef queue fill:#eae7f0,stroke:#5b5470,color:#15201e,stroke-width:1.5px");
  lines.push("  classDef actor fill:#f8faf7,stroke:#57625e,color:#15201e,stroke-width:1.5px");
  lines.push("  classDef external fill:#f3ece6,stroke:#7a5c3e,color:#15201e,stroke-width:1.5px");
  return lines.join("\n");
}

export function isFileLevelSystemDesign(design: RepositorySystemDesign) {
  const internal = design.nodes.filter((node) => node.boundaryId === "system");
  if (internal.length < 4) return false;
  const fileLabels = internal.filter((node) => /\.(?:py|tsx?|jsx?|mjs|cjs)$/i.test(node.label.trim()));
  const singleModuleNodes = internal.filter((node) => node.modulePaths.length === 1);
  return fileLabels.length / internal.length >= 0.5 || (singleModuleNodes.length === internal.length && internal.length >= 6);
}
