import path from "node:path";
import type { Language, ModuleMetric, ModuleSummary } from "./types";

export type SummarizableFile = { path: string; language: Language; source: string; lines: number };

/**
 * Explain a module from observed structure alone.
 *
 * Every module starts with this explanation, and modules outside the model
 * summary budget keep it. It never claims more than the file, its metrics, and
 * its resolved imports support, and it is labelled `deterministic-fallback` so
 * the report can show the reader where the explanation came from.
 */
export function buildDeterministicModuleSummary(
  file: SummarizableFile,
  metric: ModuleMetric,
  dependencyNames: string[]
): ModuleSummary {
  const baseName = path.basename(file.path).replace(/\.(tsx?|jsx?|mjs|cjs|py)$/, "");
  const purpose = baseName === "index" || baseName === "main"
    ? "Entry point that wires the module graph together."
    : `The ${baseName.replace(/[-_]/g, " ")} module.`;
  const firstInterestingLine = Math.max(
    1,
    file.source.split(/\r?\n/).findIndex((line) => /\b(import|export|class|function|def|async)\b/.test(line)) + 1
  );
  return {
    modulePath: file.path,
    purpose,
    responsibilities: [
      `Owns ${metric.lines} lines of ${file.language} implementation`,
      dependencyNames.length
        ? `Coordinates ${dependencyNames.length} imported module${dependencyNames.length === 1 ? "" : "s"}`
        : "Provides a leaf implementation with no local imports"
    ],
    keyFlows: ["Read the exported functions and follow the highlighted dependency edges."],
    dependencies: dependencyNames.slice(0, 8),
    risks: metric.hotspotScore > 60 ? ["High combined complexity and coupling; worth a focused review."] : [],
    confidence: "low",
    generatedBy: "deterministic-fallback",
    evidence: [{
      filePath: file.path,
      startLine: firstInterestingLine,
      endLine: Math.min(file.lines, firstInterestingLine + 18),
      reason: "Module source anchor used for the deterministic explanation and metric context."
    }]
  };
}
