/**
 * Server-side session reader for the kids-AI portal. Decodes the NextAuth JWT
 * directly (same approach as admin-role.ts, which is more reliable than auth()
 * inside route handlers / RSC here).
 *
 * Returns the signed-in user's id + role, or null when not signed in.
 */
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";

export type PortalRole = "admin" | "editor" | "author" | "parent" | "learner";

export async function getPortalSession(): Promise<{
  id: string;
  role: PortalRole;
  email: string;
  name: string;
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
    if (!token || !token.uid) return null;
    const role = (typeof token.role === "string" ? token.role : "") as PortalRole;
    return {
      id: String(token.uid),
      role,
      email: typeof token.email === "string" ? token.email : "",
      name: typeof token.name === "string" ? token.name : "",
    };
  } catch {
    return null;
  }
}

/** Staff = admin/editor/author (manage the platform). */
export function isStaff(role: PortalRole): boolean {
  return role === "admin" || role === "editor" || role === "author";
}
