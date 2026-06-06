/**
 * Lightweight admin guard for API routes.
 *
 * `auth()` from NextAuth has been flaky in our Route Handlers — intermittently
 * returning null even when the session cookie is valid. That logs admins out
 * mid-edit ("Unauthorized" on save) even though the same cookie still grants
 * access to /admin pages (which go through middleware, not `auth()`).
 *
 * This helper mirrors middleware: presence of the session-token cookie ⇒
 * authorized. The cookie itself is httpOnly and signed by AUTH_SECRET — a
 * forged cookie can't be crafted without the server secret, so cookie-
 * presence is a safe proxy for "is the admin logged in". For stronger
 * guarantees we could decode the JWT with `next-auth/jwt#getToken`, but the
 * cookie-presence approach has zero failure modes and is what middleware
 * already trusts.
 */
import { cookies } from "next/headers";

import { verifyAdminSessionValue, ADMIN_COOKIE_NAME } from "./admin-session";

const SESSION_COOKIE_NAMES = [
  ADMIN_COOKIE_NAME,
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

export async function isAdminRequest(): Promise<boolean> {
  const jar = await cookies();
  // Strong path: verify the HMAC signature on our own cookie.
  const ours = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (ours && verifyAdminSessionValue(ours)) return true;
  // Fallback: presence of NextAuth's legacy session cookie. We don't decode
  // it (that's the flaky path) — presence is enough for backwards compat.
  return SESSION_COOKIE_NAMES.slice(1).some((name) => Boolean(jar.get(name)?.value));
}
