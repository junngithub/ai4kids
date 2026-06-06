import { NextResponse } from "next/server";
import { syncAuthorized } from "@/lib/sync-auth";
import { runWeeklyBlogJob } from "@/lib/blog-jobs/weekly-blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runWeeklyBlogJob({ trigger: "http" });
  const httpStatus = result.status === "error" ? 500 : 200;
  return NextResponse.json({ ok: result.status !== "error", ...result }, { status: httpStatus });
}
