"use client";

import {
  memo,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowsClockwise,
  BracketsCurly,
  CheckCircle,
  DownloadSimple,
  FileCode,
  FileArrowDown,
  GitBranch,
  GitCommit,
  GithubLogo,
  Graph,
  Info,
  MagnifyingGlass,
  ShareNetwork,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { demoReport } from "@/lib/demo";
import { diagramToDrawio } from "@/lib/diagram-export";
import { describeGraphCoverage } from "@/lib/graph-coverage";
import { shouldStartGraphDrag } from "@/lib/graph-interaction";
import {
  buildGraphLayout,
  GRAPH_EDGE_COLOR_COUNT,
  graphEdgeColorIndex,
  routeGraphEdge,
} from "@/lib/graph-layout";
import {
  normalizeReportOverview,
  repositoryDiagramToMermaid,
} from "@/lib/project-overview";
import {
  systemDesignToDiagram,
  systemDesignToMermaid,
} from "@/lib/system-design";
import type {
  AnalysisJob,
  AnalysisReport,
  AnalyzedModule,
  DependencyEdge,
  DiagramNode,
  GraphCoverage,
  ProjectOverview,
  RepositoryDiagram,
  RepositorySystemDesign,
} from "@/lib/types";

type Props = { reportToken?: string };

const progressSteps = [
  { stage: "cloning", label: "Clone" },
  { stage: "indexing", label: "Index" },
  { stage: "graphing", label: "Map" },
  { stage: "summarizing", label: "Explain" },
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

function modelLabel(generatedBy: string) {
  return generatedBy === "deterministic-fallback"
    ? "Deterministic fallback"
    : `LLM · ${generatedBy}`;
}

function graphTarget(edge: DependencyEdge, modulePaths: Set<string>) {
  if (modulePaths.has(edge.target) || !edge.target.startsWith("."))
    return edge.target;
  const depth = edge.target.match(/^\.+/)?.[0].length ?? 0;
  const sourceDirectory = edge.source.split("/").slice(0, -1);
  const packageDirectory = sourceDirectory.slice(
    0,
    Math.max(0, sourceDirectory.length - Math.max(0, depth - 1)),
  );
  const importedModule = edge.target.slice(depth).replace(/\./g, "/");
  const base = [...packageDirectory, importedModule].filter(Boolean).join("/");
  return (
    [base, `${base}.py`, `${base}/__init__.py`].find((candidate) =>
      modulePaths.has(candidate),
    ) ?? edge.target
  );
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="Tracepath home">
      <span className="brand-icon">
        <BracketsCurly size={17} weight="bold" aria-hidden />
      </span>
      <span>Tracepath</span>
    </a>
  );
}

type GraphCanvasProps = {
  modules: AnalyzedModule[];
  edges: DependencyEdge[];
  selectedPath?: string;
  onSelect: (module: AnalyzedModule) => void;
  compact?: boolean;
};

type GraphDragState = {
  path: string;
  pointerId: number;
  pointerStartX: number;
  pointerStartY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

const GraphCanvas = memo(function GraphCanvas({
  modules,
  edges,
  selectedPath,
  onSelect,
  compact = false,
}: GraphCanvasProps) {
  const displayModules = useMemo(
    () => modules.slice(0, compact ? 6 : 30),
    [modules, compact],
  );
  const modulePaths = useMemo(
    () => new Set(modules.map((module) => module.path)),
    [modules],
  );
  const connections = useMemo(() => {
    const seen = new Set<string>();
    return edges
      .map((edge) => ({
        source: edge.source,
        target: graphTarget(edge, modulePaths),
      }))
      .filter((edge) => {
        if (!modulePaths.has(edge.source) || !modulePaths.has(edge.target))
          return false;
        const key = `${edge.source}\u0000${edge.target}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [edges, modulePaths]);
  const autoLayout = useMemo(
    () =>
      buildGraphLayout({
        nodes: displayModules.map((module) => ({ path: module.path })),
        connections,
        compact,
      }),
    [displayModules, connections, compact],
  );
  const [positions, setPositions] = useState(autoLayout.nodes);
  const [draggingPath, setDraggingPath] = useState<string>();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<GraphDragState>();
  const suppressClickRef = useRef<string>();
  const moduleByPath = useMemo(
    () => new Map(displayModules.map((module) => [module.path, module])),
    [displayModules],
  );
  const positionByPath = useMemo(
    () => new Map(positions.map((node) => [node.path, node])),
    [positions],
  );
  const arrowId = `graph-arrow-${compact ? "compact" : "full"}`;

  useEffect(() => {
    dragRef.current = undefined;
    setPositions(autoLayout.nodes);
    setDraggingPath(undefined);
  }, [autoLayout]);

  if (!displayModules.length)
    return (
      <div className="graph-empty">
        <Graph size={28} aria-hidden />
        <p>No modules match this view.</p>
      </div>
    );

  function pointerPoint(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) * autoLayout.width) / rect.width,
      y: ((event.clientY - rect.top) * autoLayout.height) / rect.height,
    };
  }

  function startDrag(
    event: React.PointerEvent<SVGGElement>,
    node: (typeof positions)[number],
  ) {
    if (compact || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointerPoint(
      event as unknown as React.PointerEvent<SVGSVGElement>,
    );
    dragRef.current = {
      path: node.path,
      pointerId: event.pointerId,
      pointerStartX: point.x,
      pointerStartY: point.y,
      originX: node.x,
      originY: node.y,
      moved: false,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointerPoint(event);
    const deltaX = point.x - drag.pointerStartX;
    const deltaY = point.y - drag.pointerStartY;
    if (!drag.moved && !shouldStartGraphDrag(deltaX, deltaY)) return;
    if (!drag.moved) {
      drag.moved = true;
      setDraggingPath(drag.path);
    }
    setPositions((current) =>
      current.map((node) =>
        node.path === drag.path
          ? {
              ...node,
              x: Math.max(
                8,
                Math.min(
                  autoLayout.width - node.width - 8,
                  drag.originX + deltaX,
                ),
              ),
              y: Math.max(
                8,
                Math.min(
                  autoLayout.height - node.height - 8,
                  drag.originY + deltaY,
                ),
              ),
            }
          : node,
      ),
    );
  }

  function finishDrag(
    event: React.PointerEvent<SVGSVGElement>,
    cancelled: boolean,
  ) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.path;
    window.setTimeout(() => {
      if (suppressClickRef.current === drag.path)
        suppressClickRef.current = undefined;
    }, 0);
    if (!cancelled && !drag.moved) {
      const module = moduleByPath.get(drag.path);
      if (module) onSelect(module);
    }
    dragRef.current = undefined;
    setDraggingPath(undefined);
    if (svgRef.current?.hasPointerCapture(event.pointerId))
      svgRef.current.releasePointerCapture(event.pointerId);
  }

  function endDrag(event: React.PointerEvent<SVGSVGElement>) {
    finishDrag(event, false);
  }

  function cancelDrag(event: React.PointerEvent<SVGSVGElement>) {
    finishDrag(event, true);
  }

  function selectNode(module: AnalyzedModule) {
    if (suppressClickRef.current === module.path) {
      suppressClickRef.current = undefined;
      return;
    }
    onSelect(module);
  }

  return (
    <div className={`graph-canvas ${compact ? "graph-canvas-compact" : ""}`}>
      {!compact ? (
        <div className="graph-toolbar">
          <span>Drag nodes to explore the dependency graph.</span>
          <button
            type="button"
            className="quiet-action"
            onClick={() => setPositions(autoLayout.nodes)}
          >
            <ArrowsClockwise size={15} aria-hidden />
            Auto arrange
          </button>
        </div>
      ) : null}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${autoLayout.width} ${autoLayout.height}`}
        role="img"
        aria-label="Repository dependency graph"
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
      >
        <defs>
          {Array.from({ length: GRAPH_EDGE_COLOR_COUNT }, (_, colorIndex) => (
            <marker
              key={colorIndex}
              id={`${arrowId}-${colorIndex}`}
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path
                d="M0,0 L7,3.5 L0,7 z"
                className={`graph-edge-color-${colorIndex}`}
                fill="currentColor"
              />
            </marker>
          ))}
        </defs>
        {connections.map((connection, index) => {
          const from = positionByPath.get(connection.source);
          const to = positionByPath.get(connection.target);
          if (!from || !to) return null;
          const colorIndex = graphEdgeColorIndex(connection.source);
          return (
            <path
              key={`${connection.source}-${connection.target}-${index}`}
              d={routeGraphEdge(from, to, index, autoLayout.width).path}
              className={`graph-edge graph-edge-color-${colorIndex}`}
              markerEnd={`url(#${arrowId}-${colorIndex})`}
            />
          );
        })}
        {positions.map((node) => {
          const module = moduleByPath.get(node.path);
          if (!module) return null;
          const isSelected = module.path === selectedPath;
          const isHot = module.metric.hotspotScore >= 70;
          const inset = compact ? 12 : 14;
          return (
            <g
              key={module.path}
              className={`graph-node ${isSelected ? "is-selected" : ""} ${isHot ? "is-hot" : ""} ${draggingPath === node.path ? "is-dragging" : ""}`}
              role="button"
              tabIndex={0}
              aria-grabbed={draggingPath === node.path}
              aria-label={`Inspect ${module.path}. Drag to reposition.`}
              onPointerDown={(event) => startDrag(event, node)}
              onClick={() => selectNode(module)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  selectNode(module);
              }}
            >
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={compact ? 7 : 9}
              />
              <text
                x={node.x + inset}
                y={node.y + (compact ? 20 : 25)}
                className="graph-node-name"
              >
                {fileName(module.path).slice(0, compact ? 19 : 22)}
              </text>
              <text
                x={node.x + inset}
                y={node.y + (compact ? 39 : 48)}
                className="graph-node-meta"
              >
                {module.cluster} / score {module.metric.hotspotScore}
              </text>
              <circle
                cx={node.x + node.width - (compact ? 12 : 15)}
                cy={node.y + (compact ? 14 : 17)}
                r={compact ? 3.5 : 4}
              />
            </g>
          );
        })}
      </svg>
      {!compact && modules.length > displayModules.length ? (
        <p className="graph-limit">
          Showing the first {displayModules.length} modules. Filter the map to
          explore the rest.
        </p>
      ) : null}
    </div>
  );
});

function HeroPreview() {
  const [selectedPath, setSelectedPath] = useState(demoReport.modules[1].path);
  const modules = demoReport.modules.slice(0, 6);
  const selected =
    modules.find((module) => module.path === selectedPath) ?? modules[0];
  return (
    <figure
      className="preview"
      aria-label="Interactive architecture report preview"
    >
      <figcaption className="preview-caption">
        <span className="preview-repository">
          <GitCommit size={14} aria-hidden />
          {demoReport.repositoryName}
        </span>
        <span className="preview-commit">
          {demoReport.branch} · {shortSha(demoReport.commitSha)}
        </span>
      </figcaption>
      <div className="preview-graph">
        <GraphCanvas
          modules={modules}
          edges={demoReport.edges}
          selectedPath={selected.path}
          onSelect={(module) => setSelectedPath(module.path)}
          compact
        />
      </div>
      <div className="preview-selection">
        <p className="preview-path">
          <FileCode size={15} aria-hidden />
          <code>{selected.path}</code>
        </p>
        <p className="preview-purpose">{cleanText(selected.summary.purpose)}</p>
        <p className="preview-provenance">
          <i
            className={`mark mark-${selected.summary.generatedBy === "deterministic-fallback" ? "observed" : "inferred"}`}
            aria-hidden
          />
          {modelLabel(selected.summary.generatedBy)} · {selected.summary.confidence} confidence
        </p>
      </div>
    </figure>
  );
}

function AnalysisProgress({ job }: { job: AnalysisJob }) {
  const failed = job.status === "failed";
  const currentIndex = Math.max(
    0,
    progressSteps.findIndex((step) => step.stage === job.status),
  );
  const activityNote =
    failed
      ? "No report was created. Fix the issue and try again."
      : job.status === "summarizing"
      ? "Reviewing modules one at a time. Larger repositories can take a few minutes."
      : "Work is continuing in the background.";
  return (
    <div className="analysis-progress" aria-live="polite">
      <div className="progress-title">
        <div>
          <span className={`progress-state${failed ? " is-failed" : ""}`}>
            {failed ? (
              <WarningCircle size={14} weight="fill" aria-hidden />
            ) : (
              <SpinnerGap size={14} weight="bold" aria-hidden />
            )}
            {failed ? "Analysis stopped" : "Analysis running"}
          </span>
          <h2>{job.message}</h2>
          <p className="progress-note">{activityNote}</p>
        </div>
        <strong>{job.progress}%</strong>
      </div>
      <ol>
        {progressSteps.map((step, index) => {
          const complete = index < currentIndex || job.status === "completed";
          const active = step.stage === job.status;
          return (
            <li key={step.stage} className={active ? "is-active" : ""}>
              <span>
                {complete ? (
                  <CheckCircle size={20} weight="fill" aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              <div>
                <strong>{step.label}</strong>
                <small>
                  {complete ? "Complete" : active ? "In progress" : "Waiting"}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
      {job.status === "failed" ? (
        <div className="progress-error">
          <WarningCircle size={19} aria-hidden />
          <span>
            {job.error ?? "The analysis stopped before a report was created."}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Explain how much of the repository the graph could actually be built from.
 *
 * Without this, a repository written mostly in a language whose imports cannot
 * be read shows a sparse graph that reads as a finding about the code rather
 * than a limit of the analysis.
 */
function GraphCoverageNote({ coverage }: { coverage?: GraphCoverage }) {
  const notice = describeGraphCoverage(coverage);
  if (!notice) return null;
  const named = notice.languages.slice(0, 4);

  return (
    <p className="graph-coverage">
      <Info size={15} aria-hidden />
      <span>
        Imports were read from {notice.filesWithImportSupport} of {notice.filesRead} files
        {" "}({notice.sharePercent}%). {notice.unreadFiles} file{notice.unreadFiles === 1 ? "" : "s"} in
        {" "}{named.join(", ")}
        {notice.languages.length > named.length ? ` and ${notice.languages.length - named.length} more` : ""}
        {" "}contribute no edges, so the graph is thinner than the repository.
      </span>
    </p>
  );
}

function Inspector({ module }: { module: AnalyzedModule }) {
  return (
    <aside className="module-inspector">
      <div className="inspector-title">
        <span className={`language-badge ${module.language}`}>
          {module.language}
        </span>
        <code>{module.path}</code>
      </div>
      <h2>{cleanText(module.summary.purpose)}</h2>
      <div className="module-metrics">
        <div>
          <strong>{module.metric.complexity}</strong>
          <span>Complexity</span>
        </div>
        <div>
          <strong>{module.metric.lines}</strong>
          <span>Lines</span>
        </div>
        <div>
          <strong>{module.metric.fanIn}</strong>
          <span>Fan-in</span>
        </div>
        <div>
          <strong>{module.metric.fanOut}</strong>
          <span>Fan-out</span>
        </div>
      </div>
      <section className="inspector-section">
        <h3>Responsibilities</h3>
        <ul>
          {module.summary.responsibilities.map((item) => (
            <li key={item}>{cleanText(item)}</li>
          ))}
        </ul>
      </section>
      {module.summary.keyFlows[0] ? (
        <section className="inspector-section">
          <h3>Primary flow</h3>
          <p>{cleanText(module.summary.keyFlows[0])}</p>
        </section>
      ) : null}
      {module.summary.evidence?.length ? (
        <section className="inspector-section">
          <h3>Evidence</h3>
          {module.summary.evidence.slice(0, 2).map((item) => (
            <div
              className="evidence-block"
              key={`${item.filePath}-${item.startLine}`}
            >
              <code>
                {item.filePath}:{item.startLine}
                {item.endLine !== item.startLine ? `-${item.endLine}` : ""}
              </code>
              <p>{cleanText(item.reason)}</p>
            </div>
          ))}
        </section>
      ) : null}
      {module.summary.risks.length ? (
        <div className="risk-callout">
          <WarningCircle size={19} aria-hidden />
          <div>
            <strong>Review signal</strong>
            <p>{cleanText(module.summary.risks[0])}</p>
          </div>
        </div>
      ) : null}
      <p className="confidence-note">
        {modelLabel(module.summary.generatedBy)}, {module.summary.confidence} confidence
      </p>
    </aside>
  );
}

const diagramKindLabel: Record<DiagramNode["kind"], string> = {
  actor: "Actor",
  service: "Service",
  container: "Container",
  worker: "Worker",
  store: "Store",
  queue: "Queue",
  artifact: "Artifact",
  transform: "Transform",
  boundary: "Boundary",
  "external-system": "External system",
};

function DiagramExports({
  diagram,
  svg,
  filePrefix = "repository-overview",
  drawioName = "Repository overview",
}: {
  diagram: RepositoryDiagram;
  svg: string;
  filePrefix?: string;
  drawioName?: string;
}) {
  function download(name: string, content: BlobPart, type: string) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadSvg() {
    if (svg) download(`${filePrefix}.svg`, svg, "image/svg+xml");
  }

  function downloadDrawio() {
    download(
      `${filePrefix}.drawio`,
      diagramToDrawio(diagram, { name: drawioName }),
      "application/xml",
    );
  }

  async function downloadPng() {
    if (!svg) return;
    const image = new window.Image();
    const source = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml" }),
    );
    image.onload = () => {
      const width = Math.max(1200, image.naturalWidth);
      const height = Math.max(600, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(2, 2);
      context.fillStyle = "#101517";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) download(`${filePrefix}.png`, blob, "image/png");
      });
      URL.revokeObjectURL(source);
    };
    image.src = source;
  }

  return (
    <div className="diagram-exports" aria-label="Export concept map">
      <button type="button" className="quiet-action" disabled={!svg} onClick={downloadSvg}>
        <DownloadSimple size={15} aria-hidden />
        SVG
      </button>
      <button
        type="button"
        className="quiet-action"
        disabled={!svg}
        onClick={() => void downloadPng()}
      >
        <DownloadSimple size={15} aria-hidden />
        PNG
      </button>
      <button type="button" className="quiet-action" onClick={downloadDrawio}>
        <FileArrowDown size={15} aria-hidden />
        Draw.io
      </button>
    </div>
  );
}

function SystemDesignExports({
  design,
  svg,
}: {
  design: RepositorySystemDesign;
  svg: string;
}) {
  const drawioDiagram = useMemo(() => systemDesignToDiagram(design), [design]);

  function download(name: string, content: BlobPart, type: string) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadSvg() {
    if (svg) download("system-design-architecture.svg", svg, "image/svg+xml");
  }

  function downloadDrawio() {
    download(
      "system-design-architecture.drawio",
      diagramToDrawio(drawioDiagram, { name: "System design architecture" }),
      "application/xml",
    );
  }

  function downloadPng() {
    if (!svg) return;
    const image = new window.Image();
    const source = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml" }),
    );
    image.onload = () => {
      const width = Math.max(1200, image.naturalWidth);
      const height = Math.max(700, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(2, 2);
      context.fillStyle = "#101517";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) download("system-design-architecture.png", blob, "image/png");
      });
      URL.revokeObjectURL(source);
    };
    image.src = source;
  }

  return (
    <div className="diagram-exports" aria-label="Export system design">
      <button
        type="button"
        className="quiet-action"
        disabled={!svg}
        onClick={downloadSvg}
      >
        <DownloadSimple size={15} aria-hidden />
        SVG
      </button>
      <button
        type="button"
        className="quiet-action"
        disabled={!svg}
        onClick={downloadPng}
      >
        <DownloadSimple size={15} aria-hidden />
        PNG
      </button>
      <button type="button" className="quiet-action" onClick={downloadDrawio}>
        <FileArrowDown size={15} aria-hidden />
        Draw.io
      </button>
    </div>
  );
}

/**
 * Draw diagrams in the page's own ink rather than a fixed palette.
 *
 * Reading the tokens back off the document keeps the rendered SVG in step with
 * the light and dark stock, and keeps the exported diagram matching what the
 * reader saw.
 */
function readTheme() {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  const sheet = token("--sheet-raised", "#f8f9f6");
  const ink = token("--ink", "#15201e");
  const rule = token("--rule-strong", "#a3aea6");

  return {
    background: sheet,
    primaryColor: token("--sheet", "#f1f3ef"),
    primaryTextColor: ink,
    primaryBorderColor: token("--observed", "#14505c"),
    secondaryColor: token("--observed-wash", "#dbe7e9"),
    tertiaryColor: sheet,
    lineColor: token("--ink-faint", "#57625e"),
    clusterBkg: token("--film-deep", "#d2d9d2"),
    clusterBorder: rule,
    edgeLabelBackground: sheet,
    fontFamily: "var(--font-data), monospace",
    fontSize: "13px",
  };
}

function MermaidCanvas({
  source,
  renderName,
  ariaLabel,
  loadingLabel,
  onRendered,
}: {
  source: string;
  renderName: string;
  ariaLabel: string;
  loadingLabel: string;
  onRendered: (svg: string) => void;
}) {
  const renderId = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setSvg("");
    setError("");
    onRendered("");
    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          flowchart: {
            htmlLabels: true,
            curve: "basis",
            nodeSpacing: 44,
            rankSpacing: 72,
            useMaxWidth: true,
          },
          themeVariables: readTheme(),
        });
        const rendered = await mermaid.render(
          `${renderName}-${renderId}`,
          source,
        );
        if (!active) return;
        setSvg(rendered.svg);
        onRendered(rendered.svg);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : `Unable to render ${ariaLabel.toLowerCase()}`,
        );
      });
    return () => {
      active = false;
    };
  }, [onRendered, renderId, source]);

  if (error)
    return (
      <div className="graph-empty">
        <WarningCircle size={28} aria-hidden />
        <p>{error}</p>
      </div>
    );
  if (!svg)
    return (
      <div className="mermaid-loading">
        <SpinnerGap size={22} aria-hidden />
        <span>{loadingLabel}</span>
      </div>
    );
  return (
    <div
      className="mermaid-system-design"
      role="img"
      aria-label={ariaLabel}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function MermaidSystemDesignCanvas({
  design,
  onRendered,
}: {
  design: RepositorySystemDesign;
  onRendered: (svg: string) => void;
}) {
  const source = useMemo(() => systemDesignToMermaid(design), [design]);
  return (
    <MermaidCanvas
      source={source}
      renderName="system-design"
      ariaLabel="System design architecture diagram"
      loadingLabel="Rendering system design"
      onRendered={onRendered}
    />
  );
}

function MermaidConceptCanvas({
  diagram,
  onRendered,
}: {
  diagram: RepositoryDiagram;
  onRendered: (svg: string) => void;
}) {
  const source = useMemo(() => repositoryDiagramToMermaid(diagram), [diagram]);
  return (
    <MermaidCanvas
      source={source}
      renderName="big-picture"
      ariaLabel="Plain-language project concept map"
      loadingLabel="Rendering project concept map"
      onRendered={onRendered}
    />
  );
}

function ProjectOverviewView({
  report,
  overview,
  diagram,
  onOpenModule,
}: {
  report: AnalysisReport;
  overview: ProjectOverview;
  diagram: RepositoryDiagram;
  onOpenModule: (modulePath: string) => void;
}) {
  const [conceptSvg, setConceptSvg] = useState("");
  const knownPaths = useMemo(
    () => new Set(report.modules.map((module) => module.path)),
    [report.modules],
  );
  return (
    <section
      className="project-overview-panel"
      aria-labelledby="big-picture-heading"
    >
      <div className="big-picture-intro">
        <div className="project-thesis">
          <span>Big picture · plain-language brief</span>
          <p className="project-question">What is this project?</p>
          <h2 id="big-picture-heading">{cleanText(overview.summary)}</h2>
          {overview.audience.length ? (
            <p className="project-audience">
              <strong>Built for</strong>{" "}
              {overview.audience.map(cleanText).join(", ")}
            </p>
          ) : null}
        </div>
        <div className="project-questions">
          <article>
            <h3>What problem does it solve?</h3>
            <p>{cleanText(overview.problem)}</p>
          </article>
          <article>
            <h3>What changes for the user?</h3>
            <p>{cleanText(overview.outcome)}</p>
          </article>
        </div>
      </div>
      <div className="project-capabilities project-capabilities-wide">
        <h3>What it helps people do</h3>
        <ul>
          {overview.capabilities.map((capability) => (
            <li key={capability}>{cleanText(capability)}</li>
          ))}
        </ul>
      </div>
      <div className="diagram-section">
        <div className="system-flow-heading">
          <div>
            <span>Mermaid concept map</span>
            <h3>From the problem to the outcome</h3>
            <p>
              {cleanText(diagram.description)}
            </p>
          </div>
          <DiagramExports diagram={diagram} svg={conceptSvg} />
        </div>
        <MermaidConceptCanvas
          diagram={diagram}
          onRendered={setConceptSvg}
        />
      </div>
      <div className="system-flow-section">
        <div className="system-flow-heading">
          <div>
            <span>What happens</span>
            <h3>The project in action</h3>
            <p>
              A plain-language journey through the experience, from start to
              useful result.
            </p>
          </div>
          <span>{overview.flow.length} stages</span>
        </div>
        <ol className="system-flow">
          {overview.flow.map((step, index) => (
            <li key={`${step.title}-${index}`}>
              <span className="flow-sequence">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h4>{cleanText(step.title)}</h4>
              <p>{cleanText(step.description)}</p>
              {step.modulePaths.length ? (
                <details className="flow-evidence">
                  <summary>View source evidence</summary>
                  <div className="flow-modules">
                    {step.modulePaths.map((modulePath) =>
                      knownPaths.has(modulePath) ? (
                        <button
                          type="button"
                          key={modulePath}
                          onClick={() => onOpenModule(modulePath)}
                          title={`Open ${modulePath}`}
                        >
                          <code>{modulePath}</code>
                        </button>
                      ) : (
                        <code key={modulePath}>{modulePath}</code>
                      ),
                    )}
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
      <div className="overview-grounding">
        <section>
          <h3>What to keep in mind</h3>
          {overview.risks.length ? (
            <ul>
              {overview.risks.map((risk) => (
                <li key={risk}>{cleanText(risk)}</li>
              ))}
            </ul>
          ) : (
            <p>
              No project-level risk was asserted from the available evidence.
            </p>
          )}
        </section>
        <section>
          <h3>Why we think this</h3>
          {overview.evidence.length ? (
            <div className="overview-evidence-list">
              {overview.evidence.slice(0, 4).map((item) => (
                <div key={`${item.filePath}-${item.startLine}`}>
                  <code>
                    {item.filePath}:{item.startLine}
                  </code>
                  <p>{cleanText(item.reason)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>
              The overview was inferred from module summaries and dependency
              structure.
            </p>
          )}
        </section>
        <p className="overview-confidence">
          {modelLabel(overview.generatedBy)} · {overview.confidence} confidence
        </p>
      </div>
    </section>
  );
}

function SystemDesignView({
  design,
  onOpenModule,
}: {
  design: RepositorySystemDesign;
  onOpenModule: (modulePath: string) => void;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState(design.nodes[0]?.id);
  const [renderedSvg, setRenderedSvg] = useState("");
  const selected =
    design.nodes.find((node) => node.id === selectedNodeId) ?? design.nodes[0];
  const boundaryById = useMemo(
    () => new Map(design.boundaries.map((boundary) => [boundary.id, boundary])),
    [design.boundaries],
  );
  const outgoing = selected
    ? design.relationships.filter(
        (relationship) =>
          relationship.source === selected.id ||
          relationship.target === selected.id,
      )
    : [];

  return (
    <section
      className="project-overview-panel system-design-panel"
      aria-labelledby="system-design-heading"
    >
      <div className="big-picture-intro">
        <div className="project-thesis">
          <span>System design architecture</span>
          <h2 id="system-design-heading">
            Logical C4 containers, boundaries, and integrations
          </h2>
          <p>
            {cleanText(design.description)} Static evidence is shown as observed
            or inferred; it is not a runtime trace.
          </p>
        </div>
        <div className="project-capabilities">
          <h3>What this view adds</h3>
          <ul>
            <li>Logical application and worker containers</li>
            <li>Queues, stores, and external integrations</li>
            <li>Evidence-linked relationships and boundaries</li>
          </ul>
        </div>
      </div>
      <div className="diagram-section">
        <div className="system-flow-heading">
          <div>
            <span>Logical architecture</span>
          </div>
          <SystemDesignExports design={design} svg={renderedSvg} />
        </div>
        <div className="diagram-wrap">
          <MermaidSystemDesignCanvas
            design={design}
            onRendered={setRenderedSvg}
          />
        </div>
        <div
          className="system-design-node-selector"
          aria-label="Inspect system-design element"
        >
          {design.nodes.map((node) => (
            <button
              type="button"
              key={node.id}
              className={selected?.id === node.id ? "is-active" : ""}
              onClick={() => setSelectedNodeId(node.id)}
            >
              <span>{diagramKindLabel[node.kind]}</span>
              <strong>{node.label}</strong>
            </button>
          ))}
        </div>
      </div>
      {selected ? (
        <div className="system-design-inspector">
          <div>
            <span className={`language-badge ${selected.kind}`}>
              {diagramKindLabel[selected.kind]}
            </span>
            <h3>{selected.label}</h3>
            <p>{cleanText(selected.description)}</p>
            <p className="confidence-note">
              {boundaryById.get(selected.boundaryId)?.label ??
                "Unknown boundary"}{" "}
              · {selected.provenance} · {selected.confidence} confidence
              {selected.technology ? ` · ${selected.technology}` : ""}
            </p>
          </div>
          <div>
            <h4>Supporting modules</h4>
            {selected.modulePaths.length ? (
              <div className="flow-modules">
                {selected.modulePaths.map((modulePath) => (
                  <button
                    type="button"
                    key={modulePath}
                    onClick={() => onOpenModule(modulePath)}
                  >
                    <code>{modulePath}</code>
                  </button>
                ))}
              </div>
            ) : (
              <p className="confidence-note">
                No internal module is directly attached to this element.
              </p>
            )}
          </div>
          <div>
            <h4>Evidence</h4>
            {selected.evidence.length ? (
              selected.evidence.map((item) => (
                <div
                  className="evidence-block"
                  key={`${item.filePath}-${item.startLine}`}
                >
                  <code>
                    {item.filePath}:{item.startLine}
                    {item.endLine !== item.startLine ? `-${item.endLine}` : ""}
                  </code>
                  <p>{cleanText(item.reason)}</p>
                </div>
              ))
            ) : (
              <p className="confidence-note">
                This element is inferred from the available architecture
                signals.
              </p>
            )}
          </div>
          <div>
            <h4>Relationships</h4>
            {outgoing.length ? (
              <ul className="system-design-relationships">
                {outgoing.map((relationship) => (
                  <li key={relationship.id}>
                    <strong>
                      {relationship.source === selected.id ? "To" : "From"}{" "}
                      {relationship.source === selected.id
                        ? relationship.target
                        : relationship.source}
                    </strong>
                    <span>
                      {relationship.label}
                      {relationship.protocol
                        ? ` · ${relationship.protocol}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="confidence-note">
                No relationship was retained for this element.
              </p>
            )}
          </div>
        </div>
      ) : null}
      <div className="overview-grounding">
        <section>
          <h3>Boundaries</h3>
          <ul>
            {design.boundaries.map((boundary) => (
              <li key={boundary.id}>
                <strong>{boundary.label}</strong> -{" "}
                {cleanText(boundary.description)}
              </li>
            ))}
          </ul>
        </section>
        <p className="overview-confidence">
          {modelLabel(design.generatedBy)}, {design.confidence} confidence
        </p>
      </div>
    </section>
  );
}

function ReportView({ report }: { report: AnalysisReport }) {
  const [activeView, setActiveView] = useState<
    "overview" | "system-design" | "modules"
  >("overview");
  const [selectedPath, setSelectedPath] = useState(
    () =>
      report.modules.find((module) => module.metric.hotspotScore >= 80)?.path ??
      report.modules[0]?.path,
  );
  const [cluster, setCluster] = useState("all");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const clusterCounts = useMemo(
    () =>
      new Map(
        report.clusters.map((item) => [
          item,
          report.modules.filter((module) => module.cluster === item).length,
        ]),
      ),
    [report.clusters, report.modules],
  );
  const visibleModules = useMemo(
    () =>
      report.modules.filter(
        (module) =>
          (cluster === "all" || module.cluster === cluster) &&
          (!deferredQuery || module.path.toLowerCase().includes(deferredQuery)),
      ),
    [report.modules, cluster, deferredQuery],
  );
  const selected =
    report.modules.find((module) => module.path === selectedPath) ??
    visibleModules[0];
  const hotspots = useMemo(
    () =>
      [...report.modules]
        .sort((a, b) => b.metric.hotspotScore - a.metric.hotspotScore)
        .slice(0, 5),
    [report.modules],
  );
  const normalizedReport = useMemo(
    () => normalizeReportOverview(report),
    [report],
  );
  const overview = normalizedReport.overview!;
  const diagram = normalizedReport.diagram!;
  const systemDesign = normalizedReport.systemDesign!;

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

  return (
    <main className="report-page">
      <header className="report-nav">
        <Brand />
        <span className="report-context">Architecture report</span>
        <div className="report-actions">
          <button
            type="button"
            className="quiet-action"
            onClick={copyReportLink}
          >
            {copied ? (
              <CheckCircle size={17} weight="fill" aria-hidden />
            ) : (
              <ShareNetwork size={17} aria-hidden />
            )}
            {copied ? "Copied" : "Share"}
          </button>
          <a className="primary-action" href="/">
            New analysis <ArrowRight size={17} aria-hidden />
          </a>
        </div>
      </header>
      <section className="report-overview">
        <div>
          <h1>{report.repositoryName}</h1>
          <div className="repository-meta">
            <span>
              <CheckCircle size={16} weight="fill" aria-hidden />
              Analysis complete
            </span>
            <span>
              <GitBranch size={16} aria-hidden />
              {report.branch}
            </span>
            <span>
              <BracketsCurly size={16} aria-hidden />
              {shortSha(report.commitSha)}
            </span>
          </div>
        </div>
        <dl>
          <div>
            <dt>Modules</dt>
            <dd>{report.totals.modules}</dd>
          </div>
          <div>
            <dt>Edges</dt>
            <dd>{report.totals.edges}</dd>
          </div>
          <div>
            <dt>Lines</dt>
            <dd>{report.totals.lines.toLocaleString()}</dd>
          </div>
        </dl>
      </section>
      <div className="report-tabs" role="tablist" aria-label="Report views">
        <button
          id="overview-tab"
          type="button"
          role="tab"
          aria-controls="overview-panel"
          aria-selected={activeView === "overview"}
          className={activeView === "overview" ? "is-active" : ""}
          onClick={() => setActiveView("overview")}
        >
          <Graph size={17} aria-hidden />
          Big picture
        </button>
        <button
          id="system-design-tab"
          type="button"
          role="tab"
          aria-controls="system-design-panel"
          aria-selected={activeView === "system-design"}
          className={activeView === "system-design" ? "is-active" : ""}
          onClick={() => setActiveView("system-design")}
        >
          <ShareNetwork size={17} aria-hidden />
          System design
        </button>
        <button
          id="modules-tab"
          type="button"
          role="tab"
          aria-controls="modules-panel"
          aria-selected={activeView === "modules"}
          className={activeView === "modules" ? "is-active" : ""}
          onClick={() => setActiveView("modules")}
        >
          <BracketsCurly size={17} aria-hidden />
          Module map
        </button>
      </div>
      {activeView === "overview" ? (
        <div
          id="overview-panel"
          className="project-overview-workspace"
          role="tabpanel"
          aria-labelledby="overview-tab"
        >
          <ProjectOverviewView
            report={report}
            overview={overview}
            diagram={diagram}
            onOpenModule={openModule}
          />
        </div>
      ) : activeView === "system-design" ? (
        <div
          id="system-design-panel"
          className="project-overview-workspace"
          role="tabpanel"
          aria-labelledby="system-design-tab"
        >
          <SystemDesignView design={systemDesign} onOpenModule={openModule} />
        </div>
      ) : (
        <div
          id="modules-panel"
          className="report-workspace"
          role="tabpanel"
          aria-labelledby="modules-tab"
        >
          <aside className="module-browser">
            <div className="module-search">
              <label htmlFor="module-search">Find a module</label>
              <div>
                <MagnifyingGlass size={16} aria-hidden />
                <input
                  id="module-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search paths"
                />
              </div>
            </div>
            <nav aria-label="Architecture areas">
              <h2>Areas</h2>
              <button
                type="button"
                className={cluster === "all" ? "is-active" : ""}
                onClick={() => setCluster("all")}
              >
                <span>All modules</span>
                <strong>{report.modules.length}</strong>
              </button>
              {report.clusters.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={cluster === item ? "is-active" : ""}
                  onClick={() => setCluster(item)}
                >
                  <span>{item}</span>
                  <strong>{clusterCounts.get(item)}</strong>
                </button>
              ))}
            </nav>
            <div className="language-summary">
              <h2>Languages</h2>
              {report.languages.map((language) => (
                <span key={language}>{language}</span>
              ))}
            </div>
          </aside>
          <div className="report-main">
            <section className="architecture-panel">
              <div className="panel-heading">
                <div>
                  <h2>Architecture map</h2>
                  <p>
                    Select a module to inspect its role, dependencies, and risk.
                  </p>
                </div>
                <span>{visibleModules.length} shown</span>
              </div>
              <GraphCoverageNote coverage={report.graphCoverage} />
              <GraphCanvas
                modules={visibleModules}
                edges={report.edges}
                selectedPath={selected?.path}
                onSelect={(module) => setSelectedPath(module.path)}
              />
            </section>
            <section className="hotspot-panel">
              <div>
                <h2>Review first</h2>
                <p>Ranked by complexity, coupling, and module size.</p>
              </div>
              <div className="hotspot-grid">
                {hotspots.map((module) => (
                  <button
                    type="button"
                    key={module.path}
                    className={
                      selected?.path === module.path ? "is-selected" : ""
                    }
                    onClick={() => setSelectedPath(module.path)}
                  >
                    <strong>{module.metric.hotspotScore}</strong>
                    <span>{module.path}</span>
                    <small>
                      Complexity {module.metric.complexity}, fan-in{" "}
                      {module.metric.fanIn}
                    </small>
                  </button>
                ))}
              </div>
            </section>
          </div>
          {selected ? (
            <Inspector module={selected} />
          ) : (
            <aside className="module-inspector inspector-empty">
              <FileCode size={28} aria-hidden />
              <p>Select a module from the map.</p>
            </aside>
          )}
        </div>
      )}
      <footer className="report-footer">
        <span>
          Deterministic syntax graphing with configured LLM summaries.
        </span>
        <span>Commit {shortSha(report.commitSha)}</span>
      </footer>
    </main>
  );
}

function ReportLoading() {
  return (
    <main className="report-page">
      <header className="report-nav">
        <Brand />
      </header>
      <div className="report-loading" aria-label="Loading report">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-meta" />
        <div className="skeleton skeleton-map" />
      </div>
    </main>
  );
}

function ReportError({ message }: { message: string }) {
  return (
    <main className="report-page">
      <header className="report-nav">
        <Brand />
      </header>
      <section className="report-error">
        <WarningCircle size={32} aria-hidden />
        <h1>Report unavailable</h1>
        <p>{message}</p>
        <a className="primary-action" href="/">
          Analyze a repository <ArrowRight size={17} aria-hidden />
        </a>
      </section>
    </main>
  );
}

/**
 * The page states its own claims the way a report does.
 *
 * Each line points at the file in this repository that supports it, and the
 * last one admits it has nothing to point at. A product whose argument is
 * calibrated confidence cannot open by overclaiming.
 */
const heroClaims: { text: string; file?: string; lines?: string }[] = [
  {
    text: "Every architectural claim carries the source range it was drawn from.",
    file: "lib/analyzer.ts",
    lines: "254-258",
  },
  {
    text: "Imports are read in 26 languages, so the map is not only a JavaScript map.",
    file: "lib/imports.ts",
    lines: "175-202",
  },
  {
    text: "Complexity and coupling are measured, never asked of the model.",
    file: "lib/analyzer.ts",
    lines: "137-142",
  },
  {
    text: "A repository at an unchanged commit is served from the report already written for it.",
    file: "lib/analysis-runner.ts",
    lines: "29-33",
  },
  {
    text: "Most people open the map before they read a word of the report.",
  },
];

function RegisterLegend() {
  return (
    <dl className="register-legend" aria-label="How claims on this page are marked">
      <div>
        <dt>
          <i className="mark mark-observed" aria-hidden />
        </dt>
        <dd>observed</dd>
      </div>
      <div>
        <dt>
          <i className="mark mark-inferred" aria-hidden />
        </dt>
        <dd>inferred</dd>
      </div>
    </dl>
  );
}

function LandingPage({
  url,
  setUrl,
  submit,
  job,
  error,
  isSubmitting,
}: {
  url: string;
  setUrl: (value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  job?: AnalysisJob;
  error: string;
  isSubmitting: boolean;
}) {
  return (
    <main className="page">
      <header className="topbar">
        <div className="topbar-left">
          <Brand />
          <span className="topbar-rule" aria-hidden />
          <a className="topbar-link" href="/report/demo">
            Sample report
          </a>
        </div>
        <RegisterLegend />
      </header>
      <div className="hero">
        <div className="hero-argument">
          <h1>
            Map the code.
            <br />
            Find the risk.
          </h1>
          <p className="hero-lede">
            Tracepath reads a public GitHub repository and returns an
            architecture report. Every claim below is marked with where it came
            from, including the one it cannot prove.
          </p>
          <div className="apparatus">
            <div className="apparatus-row apparatus-head" aria-hidden>
              <p className="apparatus-cite">Source</p>
              <p className="apparatus-claim">Claim</p>
            </div>
            {heroClaims.map((claim) => (
              <div
                className={`apparatus-row ${claim.file ? "is-observed" : "is-inferred"}`}
                key={claim.text}
              >
                <p className="apparatus-cite">
                  {claim.file ? (
                    <code>{claim.file}</code>
                  ) : (
                    <em className="apparatus-unanchored">no anchor</em>
                  )}
                  <span className="apparatus-range">
                    {claim.lines ?? "inferred"}
                    <i
                      className={`mark mark-${claim.file ? "observed" : "inferred"}`}
                      aria-hidden
                    />
                  </span>
                </p>
                <p className="apparatus-claim">{claim.text}</p>
              </div>
            ))}
          </div>
          <form className="repo-form" onSubmit={submit}>
            <label htmlFor="repository-url">Repository</label>
            <div className="repo-field">
              <GithubLogo size={16} weight="fill" aria-hidden />
              <input
                id="repository-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="github.com/owner/repo"
                autoComplete="url"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={
                  isSubmitting || Boolean(job && job.status !== "failed")
                }
              >
                {isSubmitting ? "Starting" : "Analyze"}
              </button>
            </div>
            <p className="repo-help">
              Public repositories · up to 100 MB of source · an LLM writes the
              prose, not the measurements
            </p>
            {error ? (
              <p className="repo-error">
                <WarningCircle size={15} aria-hidden />
                {error}
              </p>
            ) : null}
          </form>
        </div>
        <section className="hero-artifact" aria-label="Report preview">
          {job ? <AnalysisProgress job={job} /> : <HeroPreview />}
        </section>
      </div>
      <footer className="footer">
        <span>Tracepath</span>
        <span>Shared reports use an unlisted link, not a private one.</span>
      </footer>
    </main>
  );
}

export function AnalyzerShell({ reportToken }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<AnalysisJob>();
  const [report, setReport] = useState<AnalysisReport | undefined>(() =>
    reportToken === "demo" ? demoReport : undefined,
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!reportToken || reportToken === "demo") return;
    const controller = new AbortController();
    fetch(`/api/reports/${reportToken}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("This report is no longer available.");
        return response.json() as Promise<AnalysisReport>;
      })
      .then(setReport)
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, [reportToken]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const events = new EventSource(`/api/analyses/${job.id}/events`);
    events.onmessage = (event) => setJob(JSON.parse(event.data) as AnalysisJob);
    return () => events.close();
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (job?.status === "completed" && job.report)
      router.push(`/report/${job.report.shareToken}`);
  }, [job, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setJob(undefined);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryUrl: url }),
      });
      const data = (await response.json()) as {
        error?: string;
        analysisId?: string;
      };
      if (!response.ok || !data.analysisId) {
        setError(data.error ?? "Could not start the analysis.");
        return;
      }
      setJob({
        id: data.analysisId,
        repositoryUrl: url,
        status: "queued",
        progress: 0,
        message: "Waiting for an analyzer slot",
        createdAt: new Date().toISOString(),
      });
    } catch {
      setError(
        "The analyzer could not be reached. Check the server and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (report) return <ReportView report={report} />;
  if (reportToken && error) return <ReportError message={error} />;
  if (reportToken) return <ReportLoading />;
  return (
    <LandingPage
      url={url}
      setUrl={setUrl}
      submit={submit}
      job={job}
      error={error}
      isSubmitting={isSubmitting}
    />
  );
}
