import { analyzeRepository } from "./analyzer";
import { ensureJob, hydrateJob, saveReport, stageMessage, updateJob } from "./store";

export async function runAnalysisJob(id: string, repositoryUrl: string) {
  await hydrateJob(id);
  ensureJob(id, repositoryUrl);
  updateJob(id, { status: "cloning", progress: 5, message: stageMessage("cloning") });
  try {
    const report = await analyzeRepository({ repositoryUrl, id }, (stage, progress, message) => {
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
