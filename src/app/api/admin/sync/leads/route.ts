import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { syncAuthorized } from "@/lib/sync-auth";

/**
 * Read-only endpoint that returns the current set of lead IDs on this
 * environment. Used by scripts/pull-leads.ts to mirror the remote state
 * locally (delete-only — never overwrites local edits in the other
 * direction). Bearer or Basic auth required, same as the rest of /api/admin/sync.
 */
export async function GET(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.select({ id: leads.id, email: leads.email, createdAt: leads.createdAt }).from(leads);
  return NextResponse.json({ ok: true, leads: rows });
}
