import { Pool } from "pg";
import type { AnalysisJob, AnalysisReport } from "./types";

let pool: Pool | undefined;
let schemaReady: Promise<void> | undefined;

function getPool() {
  if (!process.env.DATABASE_URL) return undefined;
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30_000 });
  return pool;
}

async function ensureSchema() {
  const database = getPool();
  if (!database) return;
  schemaReady ??= database.query(`
    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id TEXT PRIMARY KEY,
      repository_url TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL,
      message TEXT NOT NULL,
      error TEXT,
      report JSONB,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analysis_reports (
      share_token TEXT PRIMARY KEY,
      repository_url TEXT NOT NULL,
      commit_sha TEXT NOT NULL,
      report JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS analysis_reports_repository_commit_idx
      ON analysis_reports (repository_url, commit_sha, created_at DESC);
  `).then(() => undefined).catch((error) => {
    schemaReady = undefined;
    throw error;
  });
  await schemaReady;
}

export async function persistJob(job: AnalysisJob) {
  const database = getPool();
  if (!database) return;
  try {
    await ensureSchema();
    await database.query(
      `INSERT INTO analysis_jobs (id, repository_url, status, progress, message, error, report, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET status=$3, progress=$4, message=$5, error=$6, report=$7`,
      [job.id, job.repositoryUrl, job.status, job.progress, job.message, job.error ?? null, job.report ? JSON.stringify(job.report) : null, job.createdAt]
    );
  } catch (error) {
    console.error("Unable to persist analysis job", error);
  }
}

export async function persistReport(report: AnalysisReport) {
  const database = getPool();
  if (!database) return;
  try {
    await ensureSchema();
    await database.query(
      `INSERT INTO analysis_reports (share_token, repository_url, commit_sha, report, created_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (share_token) DO UPDATE SET report=$4`,
      [report.shareToken, report.repositoryUrl, report.commitSha, JSON.stringify(report), report.analyzedAt]
    );
  } catch (error) {
    console.error("Unable to persist analysis report", error);
  }
}

export async function readJob(id: string) {
  const database = getPool();
  if (!database) return undefined;
  try {
    await ensureSchema();
    const result = await database.query("SELECT id, repository_url, status, progress, message, error, report, created_at FROM analysis_jobs WHERE id=$1", [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    return { id: row.id, repositoryUrl: row.repository_url, status: row.status, progress: row.progress, message: row.message, error: row.error ?? undefined, report: row.report ?? undefined, createdAt: new Date(row.created_at).toISOString() } as AnalysisJob;
  } catch {
    return undefined;
  }
}

export async function readReportByCommit(repositoryUrl: string, commitSha: string) {
  const database = getPool();
  if (!database) return undefined;
  try {
    await ensureSchema();
    const result = await database.query(
      "SELECT report FROM analysis_reports WHERE repository_url=$1 AND commit_sha=$2 ORDER BY created_at DESC LIMIT 1",
      [repositoryUrl, commitSha]
    );
    return (result.rows[0]?.report ?? undefined) as AnalysisReport | undefined;
  } catch {
    return undefined;
  }
}

export async function readReport(token: string) {
  const database = getPool();
  if (!database) return undefined;
  try {
    await ensureSchema();
    const result = await database.query("SELECT report FROM analysis_reports WHERE share_token=$1", [token]);
    return (result.rows[0]?.report ?? undefined) as AnalysisReport | undefined;
  } catch {
    return undefined;
  }
}
