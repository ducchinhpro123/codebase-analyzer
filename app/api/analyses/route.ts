import { NextResponse } from "next/server";
import { enqueueAnalysis } from "@/lib/queue";
import { runAnalysisJob } from "@/lib/analysis-runner";
import { createJob } from "@/lib/store";
import { repositoryUrlSchema } from "@/lib/validation";
import { takeAnalysisSlot } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 2_048) return NextResponse.json({ error: "Request is too large" }, { status: 413 });
  const identity = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const slot = takeAnalysisSlot(identity);
  if (!slot.allowed) return NextResponse.json({ error: "Analysis rate limit reached. Try again shortly." }, { status: 429, headers: { "Retry-After": String(slot.retryAfter) } });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const repositoryUrl = body && typeof body === "object" && "repositoryUrl" in body ? (body as { repositoryUrl?: unknown }).repositoryUrl : undefined;
  const parsed = repositoryUrlSchema.safeParse(repositoryUrl);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid repository URL" }, { status: 400 });
  const job = createJob(parsed.data);

  let queued = false;
  try {
    queued = await enqueueAnalysis({ id: job.id, repositoryUrl: parsed.data });
  } catch (error) {
    console.error("Remote queue unavailable; using local runner", error);
  }
  if (!queued) void runAnalysisJob(job.id, parsed.data).catch(() => undefined);

  return NextResponse.json({ analysisId: job.id, statusUrl: `/api/analyses/${job.id}`, eventsUrl: `/api/analyses/${job.id}/events`, queued }, { status: 202 });
}
