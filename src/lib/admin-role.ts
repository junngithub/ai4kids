/**
 * Server-side helper to read the admin's role + email from the session JWT.
 * Mirrors admin-guard.ts: we decode the JWT directly with next-auth/jwt rather
 * than calling auth(), which has been flaky in our route handlers.
 *
 * Returns { role: "admin" | "editor" | "author", email } if a valid JWT is
 * present, else null. Treat null as "not signed in".
 */
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";

export type AdminRole = "admin" | "editor" | "author";

export async function getAdminSession(): Promise<{
  role: AdminRole;
  email: string;
  id: string;
} | null> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  try {
    const token = await getToken({
      req: { headers: { cookie: cookieHeader } } as unknown as Request,
      secret,
      cookieName:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
    });
    if (!token) return null;
    const rawRole = typeof token.role === "string" ? token.role : "";
    // Only staff roles may hold an admin session. Parents/learners (or any
    // non-staff role) are rejected so they can't reach the back-office even
    // though they share the same NextAuth session cookie.
    if (rawRole === "parent" || rawRole === "learner") return null;
    const role: AdminRole =
      rawRole === "editor" || rawRole === "author" ? rawRole : "admin";
    return {
      role,
      email: typeof token.email === "string" ? token.email : "",
      id: typeof token.uid === "string" ? token.uid : "",
    };
  } catch {
    return null;
  }
}

export function canAccessRoute(role: AdminRole, pathname: string): boolean {
  if (role === "admin") return true;
  if (role === "editor") {
    // Editor: same as admin except cannot manage users or credentials.
    return !(
      pathname.startsWith("/admin/users") ||
      pathname.startsWith("/admin/settings/credentials")
    );
  }
  // Author: only dashboard + own posts + media upload (for embedding images).
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/posts") ||
    pathname.startsWith("/admin/media")
  );
}
