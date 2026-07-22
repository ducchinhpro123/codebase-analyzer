"use client";

import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BracketsCurly,
  CheckCircle,
  DownloadSimple,
  FileCode,
  FileArrowDown,
  GitBranch,
  GithubLogo,
  Graph,
  MagnifyingGlass,
  ShareNetwork,
  SpinnerGap,
  WarningCircle
} from "@phosphor-icons/react";
import { demoReport } from "@/lib/demo";
import { diagramToDrawio, diagramToSvg } from "@/lib/diagram-export";
import { layoutDiagram, routeDiagramEdge, shouldRenderDiagramEdgeLabel } from "@/lib/diagram-layout";
import { normalizeReportOverview } from "@/lib/project-overview";
import type { AnalysisJob, AnalysisReport, AnalyzedModule, DependencyEdge, DiagramNode, ProjectOverview, RepositoryDiagram } from "@/lib/types";

type Props = { reportToken?: string };

const progressSteps = [
  { stage: "cloning", label: "Clone" },
  { stage: "indexing", label: "Index" },
  { stage: "graphing", label: "Map" },
  { stage: "summarizing", label: "Explain" }
] as const;

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

function fileName(filePath: string) {
  return filePath.split("/").at(-1) ?? filePath;
}

function cleanText(value: string) {
  return value.replace(/[\u2014\u2013]/g, "-");
}

function graphTarget(edge: DependencyEdge, modulePaths: Set<string>) {
  if (modulePaths.has(edge.target) || !edge.target.startsWith(".")) return edge.target;
  const depth = edge.target.match(/^\.+/)?.[0].length ?? 0;
  const sourceDirectory = edge.source.split("/").slice(0, -1);
  const packageDirectory = sourceDirectory.slice(0, Math.max(0, sourceDirectory.length - Math.max(0, depth - 1)));
  const importedModule = edge.target.slice(depth).replace(/\./g, "/");
  const base = [...packageDirectory, importedModule].filter(Boolean).join("/");
  return [base, `${base}.py`, `${base}/__init__.py`].find((candidate) => modulePaths.has(candidate)) ?? edge.target;
}

function Brand() {
  return <a className="brand" href="/" aria-label="Tracepath home"><span className="brand-icon"><BracketsCurly size={17} weight="bold" aria-hidden /></span><span>Tracepath</span></a>;
}

type GraphCanvasProps = {
  modules: AnalyzedModule[];
  edges: DependencyEdge[];
  selectedPath?: string;
  onSelect: (module: AnalyzedModule) => void;
  compact?: boolean;
};

const GraphCanvas = memo(function GraphCanvas({ modules, edges, selectedPath, onSelect, compact = false }: GraphCanvasProps) {
  const displayModules = useMemo(() => modules.slice(0, compact ? 6 : 30), [modules, compact]);
  const columns = compact ? 2 : 3;
  const nodeWidth = compact ? 166 : 178;
  const nodeHeight = compact ? 64 : 70;
  const columnGap = compact ? 210 : 236;
  const rowGap = compact ? 98 : 112;
  const positions = useMemo(() => displayModules.map((module, index) => ({ module, x: 38 + (index % columns) * columnGap, y: 44 + Math.floor(index / columns) * rowGap })), [displayModules, columns, columnGap, rowGap]);
  const coords = useMemo(() => new Map(positions.map(({ module, x, y }) => [module.path, { x, y }])), [positions]);
  const modulePaths = useMemo(() => new Set(modules.map((module) => module.path)), [modules]);
  const rows = Math.max(1, Math.ceil(displayModules.length / columns));
  const width = compact ? 458 : 760;
  const height = 70 + rows * rowGap;

  if (!displayModules.length) return <div className="graph-empty"><Graph size={28} aria-hidden /><p>No modules match this view.</p></div>;

  return <div className={`graph-canvas ${compact ? "graph-canvas-compact" : ""}`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Repository dependency graph">
      {edges.map((edge, index) => {
        const from = coords.get(edge.source);
        const to = coords.get(graphTarget(edge, modulePaths));
        if (!from || !to) return null;
        const startX = from.x + nodeWidth / 2;
        const startY = from.y + nodeHeight / 2;
        const endX = to.x + nodeWidth / 2;
        const endY = to.y + nodeHeight / 2;
        return <path key={`${edge.source}-${edge.target}-${index}`} d={`M ${startX} ${startY} C ${startX} ${endY}, ${endX} ${startY}, ${endX} ${endY}`} className="graph-edge" />;
      })}
      {positions.map(({ module, x, y }) => {
        const isSelected = module.path === selectedPath;
        const isHot = module.metric.hotspotScore >= 70;
        return <g key={module.path} className={`graph-node ${isSelected ? "is-selected" : ""} ${isHot ? "is-hot" : ""}`} role="button" tabIndex={0} aria-label={`Inspect ${module.path}`} onClick={() => onSelect(module)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(module); }}>
          <rect x={x} y={y} width={nodeWidth} height={nodeHeight} rx="9" />
          <text x={x + 14} y={y + 25} className="graph-node-name">{fileName(module.path).slice(0, 22)}</text>
          <text x={x + 14} y={y + 48} className="graph-node-meta">{module.cluster} / score {module.metric.hotspotScore}</text>
          <circle cx={x + nodeWidth - 15} cy={y + 17} r="4" />
        </g>;
      })}
    </svg>
    {!compact && modules.length > displayModules.length ? <p className="graph-limit">Showing the first {displayModules.length} modules. Filter the map to explore the rest.</p> : null}
  </div>;
});

function HeroPreview() {
  const [selectedPath, setSelectedPath] = useState(demoReport.modules[1].path);
  const modules = demoReport.modules.slice(0, 6);
  const selected = modules.find((module) => module.path === selectedPath) ?? modules[0];
  return <div className="product-preview" aria-label="Interactive architecture report preview">
    <div className="preview-header"><div><GithubLogo size={17} weight="fill" aria-hidden /><span>expressjs/express</span></div><span className="preview-commit">main / ae6dd37</span></div>
    <GraphCanvas modules={modules} edges={demoReport.edges} selectedPath={selected.path} onSelect={(module) => setSelectedPath(module.path)} compact />
    <div className="preview-selection"><div><FileCode size={17} aria-hidden /><code>{selected.path}</code></div><strong>{cleanText(selected.summary.purpose)}</strong></div>
  </div>;
}

function AnalysisProgress({ job }: { job: AnalysisJob }) {
  const currentIndex = Math.max(0, progressSteps.findIndex((step) => step.stage === job.status));
  const activityNote = job.status === "summarizing"
    ? "Reviewing modules one at a time. Larger repositories can take a few minutes."
    : "Work is continuing in the background.";
  return <div className="analysis-progress" aria-live="polite">
    <div className="progress-title"><div><span className="progress-state"><SpinnerGap size={14} weight="bold" aria-hidden />Analysis running</span><h2>{job.message}</h2><p className="progress-note">{activityNote}</p></div><strong>{job.progress}%</strong></div>
    <ol>{progressSteps.map((step, index) => {
      const complete = index < currentIndex || job.status === "completed";
      const active = step.stage === job.status;
      return <li key={step.stage} className={active ? "is-active" : ""}><span>{complete ? <CheckCircle size={20} weight="fill" aria-hidden /> : index + 1}</span><div><strong>{step.label}</strong><small>{complete ? "Complete" : active ? "In progress" : "Waiting"}</small></div></li>;
    })}</ol>
    {job.status === "failed" ? <div className="progress-error"><WarningCircle size={19} aria-hidden /><span>{job.error ?? "The analysis stopped before a report was created."}</span></div> : null}
  </div>;
}

function Inspector({ module }: { module: AnalyzedModule }) {
  return <aside className="module-inspector">
    <div className="inspector-title"><span className={`language-badge ${module.language}`}>{module.language}</span><code>{module.path}</code></div>
    <h2>{cleanText(module.summary.purpose)}</h2>
    <div className="module-metrics"><div><strong>{module.metric.complexity}</strong><span>Complexity</span></div><div><strong>{module.metric.lines}</strong><span>Lines</span></div><div><strong>{module.metric.fanIn}</strong><span>Fan-in</span></div><div><strong>{module.metric.fanOut}</strong><span>Fan-out</span></div></div>
    <section className="inspector-section"><h3>Responsibilities</h3><ul>{module.summary.responsibilities.map((item) => <li key={item}>{cleanText(item)}</li>)}</ul></section>
    {module.summary.keyFlows[0] ? <section className="inspector-section"><h3>Primary flow</h3><p>{cleanText(module.summary.keyFlows[0])}</p></section> : null}
    {module.summary.evidence?.length ? <section className="inspector-section"><h3>Evidence</h3>{module.summary.evidence.slice(0, 2).map((item) => <div className="evidence-block" key={`${item.filePath}-${item.startLine}`}><code>{item.filePath}:{item.startLine}{item.endLine !== item.startLine ? `-${item.endLine}` : ""}</code><p>{cleanText(item.reason)}</p></div>)}</section> : null}
    {module.summary.risks.length ? <div className="risk-callout"><WarningCircle size={19} aria-hidden /><div><strong>Review signal</strong><p>{cleanText(module.summary.risks[0])}</p></div></div> : null}
    <p className="confidence-note">{module.summary.generatedBy === "deepseek-v4-flash" ? "DeepSeek summary" : "Deterministic summary"}, {module.summary.confidence} confidence</p>
  </aside>;
}

const diagramKindLabel: Record<DiagramNode["kind"], string> = {
  actor: "Actor",
  service: "Service",
  worker: "Worker",
  store: "Store",
  artifact: "Artifact",
  transform: "Transform",
  boundary: "Boundary"
};

function wrapDiagramText(value: string, maxChars: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current ? `${current} ${word}` : word).length > maxChars && current) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines.slice(0, 2).map((line, index, all) => index === all.length - 1 && lines.length > 2 ? `${line.slice(0, Math.max(1, maxChars - 3))}...` : line);
}

function DiagramExports({ diagram }: { diagram: RepositoryDiagram }) {
  function download(name: string, content: BlobPart, type: string) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadSvg() {
    download("repository-overview.svg", diagramToSvg(diagram), "image/svg+xml");
  }

  function downloadDrawio() {
    download("repository-overview.drawio", diagramToDrawio(diagram), "application/xml");
  }

  async function downloadPng() {
    const svg = diagramToSvg(diagram);
    const layout = layoutDiagram(diagram);
    const image = new window.Image();
    const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = layout.width * 2;
      canvas.height = layout.height * 2;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(2, 2);
      context.drawImage(image, 0, 0, layout.width, layout.height);
      canvas.toBlob((blob) => { if (blob) download("repository-overview.png", blob, "image/png"); });
      URL.revokeObjectURL(source);
    };
    image.src = source;
  }

  return <div className="diagram-exports" aria-label="Export diagram"><button type="button" className="quiet-action" onClick={downloadSvg}><DownloadSimple size={15} aria-hidden />SVG</button><button type="button" className="quiet-action" onClick={() => void downloadPng()}><DownloadSimple size={15} aria-hidden />PNG</button><button type="button" className="quiet-action" onClick={downloadDrawio}><FileArrowDown size={15} aria-hidden />Draw.io</button></div>;
}

function RepositoryDiagramCanvas({ diagram, onOpenModule }: { diagram: RepositoryDiagram; onOpenModule: (modulePath: string) => void }) {
  const layout = useMemo(() => layoutDiagram(diagram), [diagram]);
  const nodeMap = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout.nodes]);
  const presentKinds = [...new Set(diagram.nodes.map((node) => node.kind))];
  return <div className="diagram-wrap">
    <div className="diagram-legend" aria-label="Diagram legend">{presentKinds.map((kind) => <span key={kind}><i className={`diagram-kind-${kind}`} />{diagramKindLabel[kind]}</span>)}<span><i className="diagram-provenance-observed" />Observed</span><span><i className="diagram-provenance-inferred" />Inferred</span></div>
    <div className="diagram-canvas"><svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="Data-flow architecture diagram"><defs><marker id="diagram-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker></defs>{layout.relationships.map((relationship, index) => { const source = nodeMap.get(relationship.source); const target = nodeMap.get(relationship.target); if (!source || !target) return null; const route = routeDiagramEdge(source, target, index, layout.nodes, layout.width); const showLabel = shouldRenderDiagramEdgeLabel(relationship); return <g key={relationship.id} className={`diagram-relationship is-${relationship.provenance}`}><title>{relationship.label}</title><path d={route.path} markerEnd="url(#diagram-arrow)" />{showLabel ? <text x={route.labelX} y={route.labelY} className="diagram-edge-label" textAnchor="middle">{relationship.label}</text> : null}</g>; })}{layout.nodes.map((node) => <g key={node.id} className={`diagram-node is-${node.kind} is-${node.provenance}`} role={node.modulePaths.length ? "button" : undefined} tabIndex={node.modulePaths.length ? 0 : undefined} aria-label={node.modulePaths.length ? `Open supporting module ${node.modulePaths[0]}` : node.label} onClick={() => { if (node.modulePaths[0]) onOpenModule(node.modulePaths[0]); }} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && node.modulePaths[0]) onOpenModule(node.modulePaths[0]); }}><rect x={node.x} y={node.y} width={node.width} height={node.height} rx="10" /><text x={node.x + 16} y={node.y + 23} className="diagram-node-kind">{diagramKindLabel[node.kind]}</text><text x={node.x + 16} y={node.y + 50} className="diagram-node-label">{node.label.slice(0, 25)}</text><text x={node.x + 16} y={node.y + 73} className="diagram-node-description">{wrapDiagramText(node.description, 34).map((line, index) => <tspan key={line} x={node.x + 16} dy={index ? 14 : 0}>{line}</tspan>)}</text><text x={node.x + 16} y={node.y + 99} className="diagram-node-meta">{node.provenance === "observed" ? "OBSERVED" : "INFERRED"} / {node.modulePaths.length} modules</text></g>)}</svg></div>
  </div>;
}

function ProjectOverviewView({ report, overview, diagram, onOpenModule }: { report: AnalysisReport; overview: ProjectOverview; diagram: RepositoryDiagram; onOpenModule: (modulePath: string) => void }) {
  const knownPaths = useMemo(() => new Set(report.modules.map((module) => module.path)), [report.modules]);
  return <section className="project-overview-panel" aria-labelledby="big-picture-heading">
    <div className="big-picture-intro">
      <div className="project-thesis"><span>Big picture</span><h2 id="big-picture-heading">{cleanText(overview.summary)}</h2>{overview.audience.length ? <p><strong>Built for</strong> {overview.audience.map(cleanText).join(", ")}</p> : null}</div>
      <div className="project-capabilities"><h3>What it does</h3><ul>{overview.capabilities.map((capability) => <li key={capability}>{cleanText(capability)}</li>)}</ul></div>
    </div>
    <div className="diagram-section">
      <div className="system-flow-heading"><div><span>Data-flow architecture</span><h3>How the system fits together</h3><p>{cleanText(diagram.description)} Click a semantic node to inspect its supporting source.</p></div><DiagramExports diagram={diagram} /></div>
      <RepositoryDiagramCanvas diagram={diagram} onOpenModule={onOpenModule} />
    </div>
    <div className="system-flow-section">
      <div className="system-flow-heading"><div><span>System architecture</span><h3>How the project works</h3><p>Follow the main execution path, then open any source module for evidence.</p></div><span>{overview.flow.length} stages</span></div>
      <ol className="system-flow">
        {overview.flow.map((step, index) => <li key={`${step.title}-${index}`}>
          <span className="flow-sequence">{String(index + 1).padStart(2, "0")}</span>
          <h4>{cleanText(step.title)}</h4>
          <p>{cleanText(step.description)}</p>
          {step.modulePaths.length ? <div className="flow-modules">{step.modulePaths.map((modulePath) => knownPaths.has(modulePath)
            ? <button type="button" key={modulePath} onClick={() => onOpenModule(modulePath)} title={`Open ${modulePath}`}><code>{modulePath}</code></button>
            : <code key={modulePath}>{modulePath}</code>)}</div> : null}
        </li>)}
      </ol>
    </div>
    <div className="overview-grounding">
      <section><h3>Architecture signals</h3>{overview.risks.length ? <ul>{overview.risks.map((risk) => <li key={risk}>{cleanText(risk)}</li>)}</ul> : <p>No project-level risk was asserted from the available evidence.</p>}</section>
      <section><h3>Evidence used</h3>{overview.evidence.length ? <div className="overview-evidence-list">{overview.evidence.slice(0, 4).map((item) => <div key={`${item.filePath}-${item.startLine}`}><code>{item.filePath}:{item.startLine}</code><p>{cleanText(item.reason)}</p></div>)}</div> : <p>The overview was inferred from module summaries and dependency structure.</p>}</section>
      <p className="overview-confidence">{overview.generatedBy === "deepseek-v4-flash" ? "DeepSeek synthesis" : "Deterministic synthesis"}, {overview.confidence} confidence</p>
    </div>
  </section>;
}

function ReportView({ report }: { report: AnalysisReport }) {
  const [activeView, setActiveView] = useState<"overview" | "modules">("overview");
  const [selectedPath, setSelectedPath] = useState(() => report.modules.find((module) => module.metric.hotspotScore >= 80)?.path ?? report.modules[0]?.path);
  const [cluster, setCluster] = useState("all");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const clusterCounts = useMemo(() => new Map(report.clusters.map((item) => [item, report.modules.filter((module) => module.cluster === item).length])), [report.clusters, report.modules]);
  const visibleModules = useMemo(() => report.modules.filter((module) => (cluster === "all" || module.cluster === cluster) && (!deferredQuery || module.path.toLowerCase().includes(deferredQuery))), [report.modules, cluster, deferredQuery]);
  const selected = report.modules.find((module) => module.path === selectedPath) ?? visibleModules[0];
  const hotspots = useMemo(() => [...report.modules].sort((a, b) => b.metric.hotspotScore - a.metric.hotspotScore).slice(0, 5), [report.modules]);
  const normalizedReport = useMemo(() => normalizeReportOverview(report), [report]);
  const overview = normalizedReport.overview!;
  const diagram = normalizedReport.diagram!;

  async function copyReportLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  }

  function openModule(modulePath: string) {
    setSelectedPath(modulePath);
    setCluster("all");
    setQuery("");
    setActiveView("modules");
  }

  return <main className="report-page">
    <header className="report-nav"><Brand /><span className="report-context">Architecture report</span><div className="report-actions"><button type="button" className="quiet-action" onClick={copyReportLink}>{copied ? <CheckCircle size={17} weight="fill" aria-hidden /> : <ShareNetwork size={17} aria-hidden />}{copied ? "Copied" : "Share"}</button><a className="primary-action" href="/">New analysis <ArrowRight size={17} aria-hidden /></a></div></header>
    <section className="report-overview"><div><h1>{report.repositoryName}</h1><div className="repository-meta"><span><CheckCircle size={16} weight="fill" aria-hidden />Analysis complete</span><span><GitBranch size={16} aria-hidden />{report.branch}</span><span><BracketsCurly size={16} aria-hidden />{shortSha(report.commitSha)}</span></div></div><dl><div><dt>Modules</dt><dd>{report.totals.modules}</dd></div><div><dt>Edges</dt><dd>{report.totals.edges}</dd></div><div><dt>Lines</dt><dd>{report.totals.lines.toLocaleString()}</dd></div></dl></section>
    <div className="report-tabs" role="tablist" aria-label="Report views"><button id="overview-tab" type="button" role="tab" aria-controls="overview-panel" aria-selected={activeView === "overview"} className={activeView === "overview" ? "is-active" : ""} onClick={() => setActiveView("overview")}><Graph size={17} aria-hidden />Big picture</button><button id="modules-tab" type="button" role="tab" aria-controls="modules-panel" aria-selected={activeView === "modules"} className={activeView === "modules" ? "is-active" : ""} onClick={() => setActiveView("modules")}><BracketsCurly size={17} aria-hidden />Module map</button></div>
    {activeView === "overview" ? <div id="overview-panel" className="project-overview-workspace" role="tabpanel" aria-labelledby="overview-tab"><ProjectOverviewView report={report} overview={overview} diagram={diagram} onOpenModule={openModule} /></div> : <div id="modules-panel" className="report-workspace" role="tabpanel" aria-labelledby="modules-tab">
      <aside className="module-browser">
        <div className="module-search"><label htmlFor="module-search">Find a module</label><div><MagnifyingGlass size={16} aria-hidden /><input id="module-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search paths" /></div></div>
        <nav aria-label="Architecture areas"><h2>Areas</h2><button type="button" className={cluster === "all" ? "is-active" : ""} onClick={() => setCluster("all")}><span>All modules</span><strong>{report.modules.length}</strong></button>{report.clusters.map((item) => <button type="button" key={item} className={cluster === item ? "is-active" : ""} onClick={() => setCluster(item)}><span>{item}</span><strong>{clusterCounts.get(item)}</strong></button>)}</nav>
        <div className="language-summary"><h2>Languages</h2>{report.languages.map((language) => <span key={language}>{language}</span>)}</div>
      </aside>
      <div className="report-main">
        <section className="architecture-panel"><div className="panel-heading"><div><h2>Architecture map</h2><p>Select a module to inspect its role, dependencies, and risk.</p></div><span>{visibleModules.length} shown</span></div><GraphCanvas modules={visibleModules} edges={report.edges} selectedPath={selected?.path} onSelect={(module) => setSelectedPath(module.path)} /></section>
        <section className="hotspot-panel"><div><h2>Review first</h2><p>Ranked by complexity, coupling, and module size.</p></div><div className="hotspot-grid">{hotspots.map((module) => <button type="button" key={module.path} className={selected?.path === module.path ? "is-selected" : ""} onClick={() => setSelectedPath(module.path)}><strong>{module.metric.hotspotScore}</strong><span>{module.path}</span><small>Complexity {module.metric.complexity}, fan-in {module.metric.fanIn}</small></button>)}</div></section>
      </div>
      {selected ? <Inspector module={selected} /> : <aside className="module-inspector inspector-empty"><FileCode size={28} aria-hidden /><p>Select a module from the map.</p></aside>}
    </div>}
    <footer className="report-footer"><span>Deterministic syntax graphing with DeepSeek module summaries.</span><span>Commit {shortSha(report.commitSha)}</span></footer>
  </main>;
}

function ReportLoading() {
  return <main className="report-page"><header className="report-nav"><Brand /></header><div className="report-loading" aria-label="Loading report"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-meta" /><div className="skeleton skeleton-map" /></div></main>;
}

function ReportError({ message }: { message: string }) {
  return <main className="report-page"><header className="report-nav"><Brand /></header><section className="report-error"><WarningCircle size={32} aria-hidden /><h1>Report unavailable</h1><p>{message}</p><a className="primary-action" href="/">Analyze a repository <ArrowRight size={17} aria-hidden /></a></section></main>;
}

function LandingPage({ url, setUrl, submit, job, error, isSubmitting }: { url: string; setUrl: (value: string) => void; submit: (event: FormEvent<HTMLFormElement>) => void; job?: AnalysisJob; error: string; isSubmitting: boolean }) {
  return <main className="landing-page">
    <header className="site-header"><Brand /><a className="sample-link" href="/report/demo">Sample report <ArrowUpRight size={16} aria-hidden /></a></header>
    <section className="landing-hero">
      <div className="hero-content"><p className="hero-kicker">Codebase analysis</p><h1>Map the code. Find the risk.</h1><p className="hero-summary">Turn any public GitHub repository into a navigable system map in minutes.</p><form className="repository-form" onSubmit={submit}><label htmlFor="repository-url">GitHub repository</label><div className="repository-field"><GithubLogo size={20} weight="fill" aria-hidden /><input id="repository-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="github.com/owner/repository" autoComplete="url" spellCheck={false} /><button type="submit" disabled={isSubmitting || Boolean(job && job.status !== "failed")}><span>{isSubmitting ? "Starting" : "Analyze"}</span><ArrowRight size={18} aria-hidden /></button></div><p className="form-helper">Public JS, TS, and Python repositories up to 100 MB.</p>{error ? <p className="form-error"><WarningCircle size={17} aria-hidden />{error}</p> : null}</form></div>
      <div className="hero-product">{job ? <AnalysisProgress job={job} /> : <HeroPreview />}</div>
    </section>
    <section className="capability-band" aria-label="Analysis capabilities"><article><Graph size={22} aria-hidden /><div><h2>Architecture map</h2><p>See system areas and how modules connect.</p></div></article><article><GitBranch size={22} aria-hidden /><div><h2>Dependency paths</h2><p>Trace internal imports and unresolved edges.</p></div></article><article><WarningCircle size={22} aria-hidden /><div><h2>Complexity signals</h2><p>Start with the files most likely to slow a change.</p></div></article></section>
    <footer className="site-footer"><span>Tracepath</span><span>Built for unfamiliar codebases.</span></footer>
  </main>;
}

export function AnalyzerShell({ reportToken }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<AnalysisJob>();
  const [report, setReport] = useState<AnalysisReport | undefined>(() => reportToken === "demo" ? demoReport : undefined);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!reportToken || reportToken === "demo") return;
    const controller = new AbortController();
    fetch(`/api/reports/${reportToken}`, { signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error("This report is no longer available."); return response.json() as Promise<AnalysisReport>; }).then(setReport).catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [reportToken]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const events = new EventSource(`/api/analyses/${job.id}/events`);
    events.onmessage = (event) => setJob(JSON.parse(event.data) as AnalysisJob);
    return () => events.close();
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (job?.status === "completed" && job.report) router.push(`/report/${job.report.shareToken}`);
  }, [job, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setJob(undefined);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/analyses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repositoryUrl: url }) });
      const data = await response.json() as { error?: string; analysisId?: string };
      if (!response.ok || !data.analysisId) { setError(data.error ?? "Could not start the analysis."); return; }
      setJob({ id: data.analysisId, repositoryUrl: url, status: "queued", progress: 0, message: "Waiting for an analyzer slot", createdAt: new Date().toISOString() });
    } catch {
      setError("The analyzer could not be reached. Check the server and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (report) return <ReportView report={report} />;
  if (reportToken && error) return <ReportError message={error} />;
  if (reportToken) return <ReportLoading />;
  return <LandingPage url={url} setUrl={setUrl} submit={submit} job={job} error={error} isSubmitting={isSubmitting} />;
}
