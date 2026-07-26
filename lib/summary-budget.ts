import type { ModuleMetric } from "./types";

const DEFAULT_SUMMARY_BUDGET = 120;

type BudgetCandidate = { path: string; metric: ModuleMetric };

/**
 * Rank a module by how much a reader of the report depends on understanding it.
 *
 * This mirrors the ranking the Big Picture, concept map, and system-design
 * prompts use to pick their own context, so the modules those prompts read are
 * the ones the model has already explained.
 */
function importance(candidate: BudgetCandidate) {
  return candidate.metric.fanIn + candidate.metric.fanOut + candidate.metric.hotspotScore / 20;
}

/**
 * Resolve how many modules may be explained by the model in one analysis.
 *
 * The budget bounds analysis cost and latency: modules outside it keep their
 * deterministic explanation, which the report already labels as such.
 */
export function resolveSummaryBudget(configured: string | undefined): number {
  if (configured === undefined || configured.trim() === "") return DEFAULT_SUMMARY_BUDGET;
  const parsed = Number(configured);
  if (!Number.isFinite(parsed)) return DEFAULT_SUMMARY_BUDGET;
  return Math.max(0, Math.floor(parsed));
}

/** Choose the module paths worth spending model attention on, highest rank first. */
export function selectModulesForLlmSummary(modules: readonly BudgetCandidate[], budget: number): Set<string> {
  const limit = Math.max(0, Math.floor(budget) || 0);
  if (limit <= 0) return new Set();
  if (modules.length <= limit) return new Set(modules.map((module) => module.path));
  return new Set(
    [...modules]
      .sort((a, b) => importance(b) - importance(a) || a.path.localeCompare(b.path))
      .slice(0, limit)
      .map((module) => module.path)
  );
}
