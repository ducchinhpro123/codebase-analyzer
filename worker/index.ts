import { Worker } from "bullmq";
import IORedis from "ioredis";
import { runAnalysisJob } from "../lib/analysis-runner";
import type { AnalysisQueuePayload } from "../lib/queue";

if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required to start the analysis worker");
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const worker = new Worker<AnalysisQueuePayload>("tracepath-analysis", async (job) => {
  await runAnalysisJob(job.data.id, job.data.repositoryUrl);
}, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) });

worker.on("completed", (job) => console.log(`analysis ${job.id} completed`));
worker.on("failed", (job, error) => console.error(`analysis ${job?.id ?? "unknown"} failed`, error));
console.log("Tracepath worker listening");

async function shutdown() {
  await worker.close();
  await connection.quit();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
