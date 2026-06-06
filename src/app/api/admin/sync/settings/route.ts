import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { syncAuthorized } from "@/lib/sync-auth";

const payloadSchema = z.object({
  entries: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        value: z.unknown(),
      }),
    )
    .min(1)
    .max(100),
});

export async function POST(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  for (const { key, value } of parsed.data.entries) {
    await db
      .insert(settings)
      .values({ key, value: value as unknown as object })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: value as unknown as object, updatedAt: sql`now()` },
      });
  }
  return NextResponse.json({ ok: true, upserted: parsed.data.entries.length });
}
