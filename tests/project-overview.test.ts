import assert from "node:assert/strict";
import test from "node:test";
import { demoReport } from "../lib/demo";
import { diagramToDrawio, diagramToSvg } from "../lib/diagram-export";
import { layoutDiagram, routeDiagramEdge, shouldRenderDiagramEdgeLabel } from "../lib/diagram-layout";
import { buildFallbackProjectOverview, buildFallbackRepositoryDiagram, normalizeReportOverview } from "../lib/project-overview";
import { projectOverviewSchema } from "../lib/validation";

test("builds a navigable project overview from a persisted module graph", () => {
  const overview = buildFallbackProjectOverview({
    repositoryName: demoReport.repositoryName,
    languages: demoReport.languages,
    modules: demoReport.modules
  });
  const modulePaths = new Set(demoReport.modules.map((module) => module.path));

  assert.equal(projectOverviewSchema.safeParse(overview).success, true);
  assert.equal(overview.flow.length, 4);
  assert.ok(overview.capabilities.length > 0);
  assert.ok(overview.flow.flatMap((step) => step.modulePaths).every((modulePath) => modulePaths.has(modulePath)));
});

test("legacy reports receive a big-picture flow before they are rendered", () => {
  const legacyReport = { ...demoReport, overview: undefined };
  const normalized = normalizeReportOverview(legacyReport);

  assert.ok(normalized.overview);
  assert.ok(normalized.overview.flow.length >= 2);
  assert.ok(normalized.diagram);
  assert.ok(normalized.systemDesign);
  assert.equal(normalized.modules, legacyReport.modules);
});

test("persisted file-level system designs are rebuilt as logical containers", () => {
  const fileLevelDesign = {
    ...demoReport.systemDesign!,
    nodes: demoReport.modules.map((module) => ({
      id: `file-${module.id}`,
      label: module.path.split("/").at(-1)!,
      kind: "container" as const,
      description: module.summary.purpose,
      boundaryId: "system",
      modulePaths: [module.path],
      evidence: module.summary.evidence ?? [],
      provenance: "observed" as const,
      confidence: "medium" as const
    })),
    relationships: []
  };
  const normalized = normalizeReportOverview({ ...demoReport, systemDesign: fileLevelDesign });

  assert.ok(normalized.systemDesign!.nodes.length < fileLevelDesign.nodes.length);
  assert.ok(normalized.systemDesign!.nodes.every((node) => !/\.(?:py|tsx?)$/i.test(node.label)));
});

test("builds an exportable semantic diagram with traceable module links", () => {
  const diagram = buildFallbackRepositoryDiagram({ modules: demoReport.modules, edges: demoReport.edges });
  const modulePaths = new Set(demoReport.modules.map((module) => module.path));

  assert.ok(diagram.nodes.length >= 2);
  assert.ok(diagram.nodes.every((node) => node.modulePaths.every((modulePath) => modulePaths.has(modulePath))));
  assert.ok(diagram.relationships.every((relationship) => diagram.nodes.some((node) => node.id === relationship.source) && diagram.nodes.some((node) => node.id === relationship.target)));
  assert.match(diagramToSvg(diagram), /^<svg/);
  assert.match(diagramToDrawio(diagram), /<mxfile/);
});

test("routes semantic diagram edges through card gaps and hides generic dependency labels", () => {
  const diagram = buildFallbackRepositoryDiagram({ modules: demoReport.modules, edges: demoReport.edges });
  const layout = layoutDiagram(diagram);
  const relationship = layout.relationships[0];
  const source = layout.nodes.find((node) => node.id === relationship.source)!;
  const target = layout.nodes.find((node) => node.id === relationship.target)!;
  const route = routeDiagramEdge(source, target, 0, layout.nodes, layout.width);

  assert.match(route.path, /\s[HV]\s/);
  assert.equal(shouldRenderDiagramEdgeLabel({ ...relationship, kind: "depends-on" }), false);
});
