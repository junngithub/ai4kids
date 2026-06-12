/**
 * Admin guard for API routes. True ONLY for staff (admin/editor/author).
 *
 * Two valid paths:
 *   1. our own HMAC-signed admin cookie, minted by /api/admin/login — signed by
 *      AUTH_SECRET, so presence+signature alone proves a staff login; or
 *   2. a NextAuth session whose role (re-checked against the DB) is a staff role.
 *
 * IMPORTANT: cookie *presence* is NOT sufficient. Parents and learners share the
 * same NextAuth session-token cookie, so the previous presence-only check let
 * them call admin-only routes (credentials vault, uploads, AI assist). The role
 * check below is the fix. `getAdminSession` uses `next-auth/jwt#getToken` (the
 * reliable decode path — it was `auth()` that was flaky), not the bare `auth()`.
 */
import { cookies } from "next/headers";

import { verifyAdminSessionValue, ADMIN_COOKIE_NAME } from "./admin-session";
import { getAdminSession } from "./admin-role";

export async function isAdminRequest(): Promise<boolean> {
  const jar = await cookies();
  // Strong path: verify the HMAC signature on our own admin cookie.
  const ours = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (ours && verifyAdminSessionValue(ours)) return true;
  // Otherwise require a NextAuth session that resolves to a staff role.
  return (await getAdminSession()) !== null;
}
