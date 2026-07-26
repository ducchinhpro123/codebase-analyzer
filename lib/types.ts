export type Language = string;

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
  generatedBy: string;
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
  problem: string;
  outcome: string;
  audience: string[];
  capabilities: string[];
  flow: ProjectFlowStep[];
  risks: string[];
  confidence: "low" | "medium" | "high";
  generatedBy: string;
  evidence: Evidence[];
};

export type DiagramNodeKind = "actor" | "service" | "worker" | "store" | "artifact" | "transform" | "boundary" | "container" | "queue" | "external-system";
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
  generatedBy: string;
  confidence: "low" | "medium" | "high";
};

export type SystemDesignNodeKind = "actor" | "container" | "worker" | "store" | "queue" | "external-system";
export type SystemDesignBoundaryKind = "system" | "external";

export type SystemDesignBoundary = {
  id: string;
  label: string;
  description: string;
  kind: SystemDesignBoundaryKind;
  evidence: Evidence[];
  provenance: DiagramProvenance;
  confidence: "low" | "medium" | "high";
};

export type SystemDesignNode = {
  id: string;
  label: string;
  kind: SystemDesignNodeKind;
  description: string;
  technology?: string;
  boundaryId: string;
  modulePaths: string[];
  evidence: Evidence[];
  provenance: DiagramProvenance;
  confidence: "low" | "medium" | "high";
};

export type SystemDesignRelationship = {
  id: string;
  source: string;
  target: string;
  kind: "calls" | "publishes" | "reads" | "writes" | "depends-on";
  label: string;
  protocol?: string;
  evidence: Evidence[];
  provenance: DiagramProvenance;
  confidence: "low" | "medium" | "high";
};

export type RepositorySystemDesign = {
  description: string;
  boundaries: SystemDesignBoundary[];
  nodes: SystemDesignNode[];
  relationships: SystemDesignRelationship[];
  generatedBy: string;
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
  systemDesign?: RepositorySystemDesign;
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
