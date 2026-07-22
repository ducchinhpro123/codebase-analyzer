export type Language = "typescript" | "javascript" | "python" | "unknown";

export type AnalysisStage =
  | "queued"
  | "cloning"
  | "indexing"
  | "graphing"
  | "scoring"
  | "summarizing"
  | "completed"
  | "failed";

export type ModuleSummary = {
  modulePath: string;
  purpose: string;
  responsibilities: string[];
  keyFlows: string[];
  dependencies: string[];
  risks: string[];
  confidence: "low" | "medium" | "high";
  generatedBy: "deepseek-v4-flash" | "deterministic-fallback";
  evidence?: Evidence[];
};

export type Evidence = {
  filePath: string;
  startLine: number;
  endLine: number;
  reason: string;
};

export type ProjectFlowStep = {
  title: string;
  description: string;
  modulePaths: string[];
};

export type ProjectOverview = {
  summary: string;
  audience: string[];
  capabilities: string[];
  flow: ProjectFlowStep[];
  risks: string[];
  confidence: "low" | "medium" | "high";
  generatedBy: "deepseek-v4-flash" | "deterministic-fallback";
  evidence: Evidence[];
};

export type DiagramNodeKind = "actor" | "service" | "worker" | "store" | "artifact" | "transform" | "boundary";
export type DiagramProvenance = "observed" | "inferred";

export type DiagramNode = {
  id: string;
  label: string;
  kind: DiagramNodeKind;
  description: string;
  modulePaths: string[];
  evidence: Evidence[];
  provenance: DiagramProvenance;
  confidence: "low" | "medium" | "high";
};

export type DiagramRelationship = {
  id: string;
  source: string;
  target: string;
  kind: "depends-on" | "reads" | "writes" | "transforms" | "publishes" | "calls";
  label: string;
  evidence: Evidence[];
  provenance: DiagramProvenance;
  confidence: "low" | "medium" | "high";
};

export type RepositoryDiagram = {
  description: string;
  nodes: DiagramNode[];
  relationships: DiagramRelationship[];
  generatedBy: "deepseek-v4-flash" | "deterministic-fallback";
  confidence: "low" | "medium" | "high";
};

export type ModuleMetric = {
  complexity: number;
  lines: number;
  fanIn: number;
  fanOut: number;
  hotspotScore: number;
};

export type AnalyzedModule = {
  id: string;
  path: string;
  language: Language;
  cluster: string;
  metric: ModuleMetric;
  summary: ModuleSummary;
};

export type DependencyEdge = {
  source: string;
  target: string;
  kind: "import" | "require" | "from" | "unresolved";
  line?: number;
};

export type AnalysisReport = {
  id: string;
  shareToken: string;
  repositoryUrl: string;
  repositoryName: string;
  commitSha: string;
  branch: string;
  analyzedAt: string;
  languages: Language[];
  totals: { files: number; lines: number; modules: number; edges: number };
  modules: AnalyzedModule[];
  edges: DependencyEdge[];
  clusters: string[];
  overview?: ProjectOverview;
  diagram?: RepositoryDiagram;
};

export type AnalysisJob = {
  id: string;
  repositoryUrl: string;
  status: AnalysisStage;
  progress: number;
  message: string;
  report?: AnalysisReport;
  error?: string;
  createdAt: string;
};
