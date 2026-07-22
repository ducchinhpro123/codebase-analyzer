import { NextResponse } from "next/server";
import { getJobAsync } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const job = await getJobAsync(params.id);
  if (!job) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  return NextResponse.json(job);
}
