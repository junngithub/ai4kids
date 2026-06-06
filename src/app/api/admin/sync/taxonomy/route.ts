import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories, tags } from "@/db/schema";
import { syncAuthorized } from "@/lib/sync-auth";

const taxon = z.object({
  slug: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(["page", "post"]).optional(),
});

const payloadSchema = z.object({
  categories: z.array(taxon).max(500).optional().default([]),
  tags: z.array(taxon.omit({ description: true })).max(1000).optional().default([]),
});

export async function POST(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  for (const c of parsed.data.categories) {
    const type = c.type ?? "post";
    await db
      .insert(categories)
      .values({ slug: c.slug, name: c.name, description: c.description ?? null, type })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { name: c.name, description: c.description ?? null, type },
      });
  }
  for (const t of parsed.data.tags) {
    await db
      .insert(tags)
      .values({ slug: t.slug, name: t.name })
      .onConflictDoUpdate({
        target: tags.slug,
        set: { name: t.name },
      });
  }

  return NextResponse.json({
    ok: true,
    categories: parsed.data.categories.length,
    tags: parsed.data.tags.length,
  });
}
