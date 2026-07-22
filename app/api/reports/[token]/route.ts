import { NextResponse } from "next/server";
import { normalizeReportOverview } from "@/lib/project-overview";
import { getReportAsync } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const report = await getReportAsync(params.token);
  if (!report) return NextResponse.json({ error: "Report not found or no longer available" }, { status: 404 });
  return NextResponse.json(normalizeReportOverview(report));
}
