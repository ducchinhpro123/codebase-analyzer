import { hasImportSupport } from "./imports";
import type { DependencyEdge, GraphCoverage, Language } from "./types";

/**
 * Measure how much of the repository the dependency graph could be built from.
 *
 * A language without an import extractor contributes no edges, so a repository
 * written in one produces a sparse graph that is a limit of the analysis rather
 * than a finding about the code. Reporting coverage lets the report say which
 * it is.
 */
export type GraphCoverageNotice = {
  filesRead: number;
  filesWithImportSupport: number;
  unreadFiles: number;
  sharePercent: number;
  languages: Language[];
};

/**
 * Describe coverage only when it changes how the graph should be read.
 *
 * A repository whose imports were all readable needs no explanation, so this
 * returns nothing and the report stays quiet rather than adding noise.
 */
export function describeGraphCoverage(coverage: GraphCoverage | undefined): GraphCoverageNotice | undefined {
  if (!coverage?.filesRead) return undefined;
  const unreadFiles = coverage.filesRead - coverage.filesWithImportSupport;
  if (!unreadFiles || !coverage.languagesWithoutImportSupport.length) return undefined;
  return {
    filesRead: coverage.filesRead,
    filesWithImportSupport: coverage.filesWithImportSupport,
    unreadFiles,
    sharePercent: Math.round((coverage.filesWithImportSupport / coverage.filesRead) * 100),
    languages: coverage.languagesWithoutImportSupport
  };
}

export function buildGraphCoverage(
  files: readonly { language: Language }[],
  edges: readonly DependencyEdge[]
): GraphCoverage {
  const supported = new Set<Language>();
  const unsupported = new Set<Language>();
  let filesWithImportSupport = 0;

  for (const file of files) {
    if (hasImportSupport(file.language)) {
      supported.add(file.language);
      filesWithImportSupport += 1;
    } else {
      unsupported.add(file.language);
    }
  }

  const unresolvedEdges = edges.filter((item) => item.kind === "unresolved").length;
  return {
    filesRead: files.length,
    filesWithImportSupport,
    languagesWithImportSupport: [...supported].sort(),
    languagesWithoutImportSupport: [...unsupported].sort(),
    resolvedEdges: edges.length - unresolvedEdges,
    unresolvedEdges
  };
}
