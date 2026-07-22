import IORedis from "ioredis";
import { Queue } from "bullmq";

export type AnalysisQueuePayload = { id: string; repositoryUrl: string };
const runtime = globalThis as typeof globalThis & { __tracepathQueue?: Queue<AnalysisQueuePayload> };

function getQueue() {
  if (!process.env.REDIS_URL) return undefined;
  if (runtime.__tracepathQueue) return runtime.__tracepathQueue;
  const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  runtime.__tracepathQueue = new Queue<AnalysisQueuePayload>("tracepath-analysis", { connection });
  return runtime.__tracepathQueue;
}

export async function enqueueAnalysis(payload: AnalysisQueuePayload) {
  const queue = getQueue();
  if (!queue) return false;
  await queue.add("analyze-repository", payload, { jobId: payload.id, attempts: 3, backoff: { type: "exponential", delay: 2_000 }, removeOnComplete: 100, removeOnFail: 100 });
  return true;
}

export function hasRemoteQueue() {
  return Boolean(process.env.REDIS_URL);
}
