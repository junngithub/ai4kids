import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { pages, users, categories } from "@/db/schema";
import { syncAuthorized } from "@/lib/sync-auth";

const pageSchema = z.object({
  slug: z.string().min(1).max(255),
  title: z.string().min(1).max(500),
  excerpt: z.string().max(5000).optional().nullable(),
  content: z.unknown(), // TipTap JSON
  contentHtml: z.string().optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  seoTitle: z.string().max(500).optional().nullable(),
  seoDescription: z.string().max(5000).optional().nullable(),
  seoKeywords: z.string().max(5000).optional().nullable(),
  ogImage: z.string().max(2000).optional().nullable(),
  canonicalUrl: z.string().max(2000).optional().nullable(),
  noIndex: z.boolean().optional().default(false),
  authorEmail: z.string().email().optional().nullable(),
  categorySlug: z.string().max(255).optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime().optional().nullable(),
});

const payloadSchema = z.object({
  pages: z.array(pageSchema).min(1).max(200),
});

async function resolveAuthorId(email: string | null | undefined): Promise<number | null> {
  if (!email) return null;
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return u?.id ?? null;
}

async function resolveCategoryId(slug: string | null | undefined): Promise<number | null> {
  if (!slug) return null;
  const [c] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  if (c) return c.id;
  // Auto-create the category (esp. "portfolio") so prod doesn't need a separate seed.
  const [ins] = await db
    .insert(categories)
    .values({ slug, name: slug.charAt(0).toUpperCase() + slug.slice(1) })
    .returning();
  return ins.id;
}

export async function POST(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let upserted = 0;
  for (const p of parsed.data.pages) {
    const authorId = await resolveAuthorId(p.authorEmail);
    const categoryId = await resolveCategoryId(p.categorySlug);
    const row = {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? null,
      content: p.content as unknown as object,
      contentHtml: p.contentHtml ?? null,
      status: p.status,
      seoTitle: p.seoTitle ?? null,
      seoDescription: p.seoDescription ?? null,
      seoKeywords: p.seoKeywords ?? null,
      ogImage: p.ogImage ?? null,
      canonicalUrl: p.canonicalUrl ?? null,
      noIndex: p.noIndex ?? false,
      authorId,
      categoryId,
      publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
    };
    const createdAt = p.createdAt ? new Date(p.createdAt) : null;
    await db
      .insert(pages)
      .values(createdAt ? { ...row, createdAt } : row)
      .onConflictDoUpdate({
        target: pages.slug,
        set: createdAt ? { ...row, createdAt, updatedAt: sql`now()` } : { ...row, updatedAt: sql`now()` },
      });
    upserted += 1;
  }

  return NextResponse.json({ ok: true, upserted });
}
