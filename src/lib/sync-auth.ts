import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Auth guard for /api/admin/sync/* endpoints.
 * Accepts either:
 *   1. `Authorization: Bearer <SYNC_API_TOKEN>` — shared secret, fastest, env-driven.
 *   2. `Authorization: Basic base64(email:password)` — admin user credentials,
 *      validated against the `users` table. Useful when no SYNC_API_TOKEN is
 *      configured on the server (e.g. one-off pushes from a developer machine).
 *
 * Returns true if EITHER path succeeds. Fails closed otherwise.
 */
export async function syncAuthorized(req: Request): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  if (/^Bearer\s+/i.test(header)) return checkBearer(header);
  if (/^Basic\s+/i.test(header)) return await checkBasic(header);
  return false;
}

function checkBearer(header: string): boolean {
  const expected = process.env.SYNC_API_TOKEN;
  if (!expected) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const a = Buffer.from(match[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function checkBasic(header: string): Promise<boolean> {
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const email = decoded.slice(0, idx);
  const password = decoded.slice(idx + 1);
  if (!email || !password) return false;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user || user.role !== "admin" || !user.passwordHash) return false;
  try {
    return await bcrypt.compare(password, user.passwordHash);
  } catch {
    return false;
  }
}
