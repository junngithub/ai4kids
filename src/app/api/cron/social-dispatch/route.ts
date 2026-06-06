/**
 * Cron-driven dispatcher for scheduled social posts.
 * Coolify cron should hit this every 5 minutes with the bearer token:
 *
 *   curl -X POST -H "Authorization: Bearer $SYNC_API_TOKEN" \
 *        https://www.tertiaryinfotech.com/api/cron/social-dispatch
 *
 * The same SYNC_API_TOKEN already protects /api/admin/sync/* — no new secret.
 */

import { NextResponse } from "next/server";
import { syncAuthorized } from "@/lib/sync-auth";
import { dispatchDueSocialPosts } from "@/lib/social/dispatch";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await dispatchDueSocialPosts();
  return NextResponse.json({ ok: true, ...r });
}

// GET is also allowed so a simple cron / uptime check that only emits GET
// can trigger the dispatcher. Same bearer auth applies.
export async function GET(req: Request) {
  return POST(req);
}
