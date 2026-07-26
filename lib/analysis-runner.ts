import { analyzeRepository } from "./analyzer";
import { resolveHeadCommit } from "./git-remote";
import { ensureJob, findReportForCommit, hydrateJob, saveReport, stageMessage, updateJob } from "./store";
import type { AnalysisReport } from "./types";

export type AnalysisRunnerDependencies = {
  resolveHeadCommit: (repositoryUrl: string) => Promise<string | undefined>;
  findCachedReport: (repositoryUrl: string, commitSha: string) => Promise<AnalysisReport | undefined>;
  analyze: typeof analyzeRepository;
};

const defaultDependencies: AnalysisRunnerDependencies = {
  resolveHeadCommit,
  findCachedReport: findReportForCommit,
  analyze: analyzeRepository
};

export async function runAnalysisJob(
  id: string,
  repositoryUrl: string,
  overrides: Partial<AnalysisRunnerDependencies> = {}
) {
  const { resolveHeadCommit: resolveHead, findCachedReport, analyze } = { ...defaultDependencies, ...overrides };
  await hydrateJob(id);
  ensureJob(id, repositoryUrl);
  try {
    // An unchanged commit produces an unchanged report, so check for a stored
    // one before paying for a clone and a full reading of the codebase.
    const headCommit = await resolveHead(repositoryUrl);
    const cached = headCommit ? await findCachedReport(repositoryUrl, headCommit) : undefined;
    if (cached) {
      updateJob(id, { status: "completed", progress: 100, message: "Reusing the report already generated for this commit", report: cached });
      return cached;
    }

    updateJob(id, { status: "cloning", progress: 5, message: stageMessage("cloning") });
    const report = await analyze({ repositoryUrl, id }, (stage, progress, message) => {
      updateJob(id, { status: stage, progress, message });
    });
    saveReport(report);
    updateJob(id, { status: "completed", progress: 100, message: stageMessage("completed"), report });
    return report;
  } catch (error) {
    updateJob(id, { status: "failed", progress: 100, message: stageMessage("failed"), error: error instanceof Error ? error.message : "Analysis failed" });
    throw error;
  }
}
