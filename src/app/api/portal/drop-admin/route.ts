import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-session";

/**
 * Drops the staff admin HMAC cookie (`ti_admin_session`). Called the moment a
 * learner/parent signs in, so a single browser can't be "kid + admin" at once —
 * otherwise a leftover staff login would keep granting /admin access alongside
 * the kid session. The cookie is httpOnly, so only the server can clear it.
 *
 * Safe to call by anyone: it only deletes the caller's own admin cookie.
 */
export async function POST() {
  (await cookies()).delete({ name: ADMIN_COOKIE_NAME, path: "/" });
  return NextResponse.json({ ok: true });
}
