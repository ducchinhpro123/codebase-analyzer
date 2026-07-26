import { resolveImportTargets } from "./import-resolution";
import { extractImports } from "./imports";
import type { DependencyEdge, Language } from "./types";

export type GraphSourceFile = { path: string; language: Language; source: string };

/**
 * Build the dependency edges between the analyzed files.
 *
 * An import that names something outside the repository is kept as an
 * `unresolved` edge rather than dropped: it is real evidence of what a module
 * depends on, and the report distinguishes it from an edge that landed on a
 * module in the graph.
 */
export function buildDependencyEdges(
  files: readonly GraphSourceFile[],
  options: { goModulePath?: string } = {}
): DependencyEdge[] {
  const context = { paths: new Set(files.map((file) => file.path)), goModulePath: options.goModulePath };
  const edges: DependencyEdge[] = [];

  for (const file of files) {
    for (const imported of extractImports(file.language, file.source)) {
      const targets = resolveImportTargets(file.path, file.language, imported.specifier, context);
      if (!targets.length) {
        edges.push({ source: file.path, target: imported.specifier, kind: "unresolved", line: imported.line });
        continue;
      }
      for (const target of targets) {
        if (target === file.path) continue;
        edges.push({ source: file.path, target, kind: imported.kind, line: imported.line });
      }
    }
  }
  return edges;
}
