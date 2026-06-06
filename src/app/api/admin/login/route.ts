/**
 * Admin login — sets the custom HMAC-signed session cookie. Runs alongside
 * NextAuth's own login so the admin chrome (which uses cookie-presence) sees
 * a stable cookie even when NextAuth's JWT cookie hiccups.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ADMIN_COOKIE_NAME, adminCookieOptions, mintAdminSessionValue } from "@/lib/admin-session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const value = mintAdminSessionValue(user.id, user.email ?? email);
  const jar = await cookies();
  jar.set(ADMIN_COOKIE_NAME, value, adminCookieOptions());

  return NextResponse.json({ ok: true });
}
