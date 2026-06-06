import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { posts } from "@/db/schema";

const schema = z.object({
  slug: z.string().min(1).max(255),
  action: z.enum(["like", "unlike"]).optional().default("like"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const delta =
    parsed.data.action === "unlike"
      ? sql`GREATEST(${posts.likeCount} - 1, 0)`
      : sql`${posts.likeCount} + 1`;
  const [row] = await db
    .update(posts)
    .set({ likeCount: delta })
    .where(eq(posts.slug, parsed.data.slug))
    .returning({ likeCount: posts.likeCount });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ likeCount: row.likeCount });
}
