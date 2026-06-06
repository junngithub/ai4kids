import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { syncAuthorized } from "@/lib/sync-auth";

/**
 * Sync admin users from local → remote.
 *
 * IMPORTANT: only `passwordHash` is accepted (bcrypt-hashed), never plaintext
 * passwords. Hashes are still sensitive — this endpoint accepts BEARER auth
 * only (no Basic), because the whole point of this endpoint is to bootstrap
 * the admin user when Basic auth would fail.
 */
const userSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  role: z.enum(["admin", "editor"]).default("admin"),
  passwordHash: z.string().min(20).max(120), // bcrypt hashes are ~60 chars
});

const payloadSchema = z.object({
  users: z.array(userSchema).min(1).max(20),
});

function bearerOnly(req: Request): boolean {
  // Reject Basic — see file header rationale.
  const header = req.headers.get("authorization") ?? "";
  return /^Bearer\s+/i.test(header);
}

export async function POST(req: Request) {
  if (!bearerOnly(req)) {
    return NextResponse.json(
      { error: "Users sync requires Bearer auth (SYNC_API_TOKEN)" },
      { status: 401 },
    );
  }
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let upserted = 0;
  for (const u of parsed.data.users) {
    await db
      .insert(users)
      .values({
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: u.passwordHash,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: u.name,
          role: u.role,
          passwordHash: u.passwordHash,
        },
      });
    upserted += 1;
  }

  return NextResponse.json({ ok: true, upserted });
}
