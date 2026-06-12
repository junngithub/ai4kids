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
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type AdminRole = "admin" | "editor" | "author";

const STAFF_ROLES: readonly AdminRole[] = ["admin", "editor", "author"];

export function isStaffRole(role: string | null | undefined): role is AdminRole {
  return STAFF_ROLES.includes(role as AdminRole);
}

/**
 * Resolve a user id to their current staff role, or null if they're not staff
 * (or don't exist). Used to re-verify the HMAC admin cookie against the DB so a
 * stale cookie (minted before a demotion, or for a non-staff account) can't keep
 * granting access.
 */
export async function staffRoleForUserId(id: number): Promise<AdminRole | null> {
  if (!Number.isInteger(id)) return null;
  try {
    const [row] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!row) return null;
    return isStaffRole(row.role) ? row.role : null;
  } catch {
    return null;
  }
}

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
    const uid = typeof token.uid === "string" ? token.uid : "";
    const numericId = Number(uid);
    if (!uid || !Number.isInteger(numericId)) return null;
    // Never trust the JWT's role claim for privilege — sessions here last 10
    // years and never refresh, so a stale or blank claim must NOT grant access.
    // Re-read the role from the DB: this fails CLOSED for non-staff and makes
    // role changes / revocations take effect on the very next request.
    const [row] = await db
      .select({ role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, numericId))
      .limit(1);
    if (!row) return null;
    if (!STAFF_ROLES.includes(row.role as AdminRole)) return null;
    return { role: row.role as AdminRole, email: row.email ?? "", id: uid };
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
