import type { AnalysisJob, AnalysisReport, AnalysisStage } from "./types";
import { demoReport } from "./demo";
import fs from "node:fs";
import path from "node:path";
import { persistJob, persistReport, readJob, readReport, readReportByCommit } from "./persistence";

// The store is intentionally small: the seam lets a Postgres adapter replace it
// without changing the API or worker implementation. It is suitable for local
// development and keeps the first run dependency-free.
type StoreState = { jobs: Map<string, AnalysisJob>; reports: Map<string, AnalysisReport> };
const runtime = globalThis as typeof globalThis & { __tracepathStore?: StoreState };
function loadState(): StoreState {
  try {
    const file = process.env.STORE_FILE ?? path.join(process.cwd(), "data", "store.json");
    const saved = JSON.parse(fs.readFileSync(file, "utf8")) as { jobs?: AnalysisJob[]; reports?: AnalysisReport[] };
    return { jobs: new Map((saved.jobs ?? []).map((job) => [job.id, job])), reports: new Map((saved.reports ?? []).map((report) => [report.shareToken, report])) };
  } catch {
    return { jobs: new Map(), reports: new Map() };
  }
}
function persistState() {
  try {
    const file = process.env.STORE_FILE ?? path.join(process.cwd(), "data", "store.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ jobs: [...state.jobs.values()], reports: [...state.reports.values()] }));
  } catch {
    // Persistence is best-effort in read-only environments; the in-process adapter remains usable.
  }
}
const state: StoreState = runtime.__tracepathStore ?? loadState();
runtime.__tracepathStore = state;
const jobs = state.jobs;
const reports = state.reports;

export function createJob(repositoryUrl: string): AnalysisJob {
  const id = crypto.randomUUID();
  const job: AnalysisJob = {
    id,
    repositoryUrl,
    status: "queued",
    progress: 0,
    message: "Waiting for an analyzer slot",
    createdAt: new Date().toISOString()
  };
  jobs.set(id, job);
  persistState();
  void persistJob(job);
  return job;
}

export function getJob(id: string) {
  return jobs.get(id);
}

export async function getJobAsync(id: string) {
  return (await readJob(id)) ?? jobs.get(id);
}

export async function hydrateJob(id: string) {
  if (jobs.has(id)) return jobs.get(id);
  const job = await readJob(id);
  if (job) jobs.set(id, job);
  return job;
}

export function ensureJob(id: string, repositoryUrl: string) {
  const existing = jobs.get(id);
  if (existing) return existing;
  const job: AnalysisJob = { id, repositoryUrl, status: "queued", progress: 0, message: stageMessage("queued"), createdAt: new Date().toISOString() };
  jobs.set(id, job);
  persistState();
  void persistJob(job);
  return job;
}

export function updateJob(id: string, update: Partial<Pick<AnalysisJob, "status" | "progress" | "message" | "error" | "report">>) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, update);
  jobs.set(id, job);
  persistState();
  void persistJob(job);
}

export function saveReport(report: AnalysisReport) {
  reports.set(report.shareToken, report);
  persistState();
  void persistReport(report);
  return report;
}

export function getReport(token: string) {
  if (token === "demo") return demoReport;
  return reports.get(token);
}

export async function getReportAsync(token: string) {
  if (token === "demo") return demoReport;
  return (await readReport(token)) ?? reports.get(token);
}

export function findReport(repositoryUrl: string, commitSha: string) {
  return [...reports.values()].find(
    (report) => report.repositoryUrl === repositoryUrl && report.commitSha === commitSha
  );
}

/**
 * Look for a report already generated for this exact commit.
 *
 * A repository at an unchanged commit produces an unchanged report, so reusing
 * it avoids re-cloning and re-reading the whole codebase.
 */
export async function findReportForCommit(repositoryUrl: string, commitSha: string) {
  return findReport(repositoryUrl, commitSha) ?? (await readReportByCommit(repositoryUrl, commitSha));
}

export function stageMessage(stage: AnalysisStage) {
  return {
    queued: "Waiting for an analyzer slot",
    cloning: "Cloning a detached snapshot",
    indexing: "Indexing source files and imports",
    graphing: "Drawing the dependency graph",
    scoring: "Finding complexity hotspots",
    summarizing: "Asking the LLM what the project does and why it matters",
    completed: "Report ready",
    failed: "Analysis stopped"
  }[stage];
}
