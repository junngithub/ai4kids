/**
 * Custom admin session cookie — runs alongside NextAuth's JWT cookie so the
 * admin stays signed in even if NextAuth's cookie gets wiped (a recurring
 * bug with the v5 beta + Turbopack on localhost). HMAC-signed with
 * AUTH_SECRET, 10-year TTL, opaque to the browser.
 *
 * Format: `<userId>.<emailB64>.<expiresAtSec>.<sigB64Url>`
 */
import crypto from "node:crypto";

export const ADMIN_COOKIE_NAME = "ti_admin_session";
const TEN_YEARS_SEC = 60 * 60 * 24 * 365 * 10;

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is required to sign admin sessions");
  return s;
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export type AdminSession = { userId: number; email: string; expiresAt: number };

export function mintAdminSessionValue(userId: number, email: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TEN_YEARS_SEC;
  const emailEnc = Buffer.from(email, "utf8").toString("base64url");
  const payload = `${userId}.${emailEnc}.${expiresAt}`;
  return `${payload}.${hmac(payload)}`;
}

export function verifyAdminSessionValue(raw: string | undefined | null): AdminSession | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [userIdStr, emailEnc, expiresStr, sig] = parts;
  const payload = `${userIdStr}.${emailEnc}.${expiresStr}`;
  let expected: string;
  try {
    expected = hmac(payload);
  } catch {
    return null;
  }
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const userId = Number(userIdStr);
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(userId) || !Number.isFinite(expiresAt)) return null;
  if (expiresAt < Math.floor(Date.now() / 1000)) return null;
  let email: string;
  try {
    email = Buffer.from(emailEnc, "base64url").toString("utf8");
  } catch {
    return null;
  }
  return { userId, email, expiresAt };
}

export function adminCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: TEN_YEARS_SEC,
    secure: process.env.NODE_ENV === "production",
  };
}
