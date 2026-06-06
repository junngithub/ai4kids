import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { syncAuthorized } from "@/lib/sync-auth";

const payloadSchema = z.object({
  likes: z
    .array(
      z.object({
        slug: z.string().min(1).max(255),
        likeCount: z.number().int().min(0).max(1000000),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  let updated = 0;
  const missing: string[] = [];
  for (const { slug, likeCount } of parsed.data.likes) {
    const res = await db
      .update(posts)
      .set({ likeCount })
      .where(eq(posts.slug, slug))
      .returning({ id: posts.id });
    if (res.length) updated += 1;
    else missing.push(slug);
  }
  return NextResponse.json({ ok: true, updated, missing });
}
