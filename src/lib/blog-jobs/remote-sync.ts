/**
 * Mirror a single newly-created post to the production CMS via the existing
 * /api/admin/sync/posts endpoint. Used by the weekly-blog orchestrator so a
 * local "Run now" actually publishes to www.tertiaryinfotech.com.
 *
 * When run on the production container itself, REMOTE_SYNC_URL is unset and
 * this is a no-op — the post is already on prod.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts, postTags, tags, categories, users } from "@/db/schema";

export type PushResult =
  | { status: "skipped"; reason: string }
  | { status: "ok"; httpStatus: number; body: string }
  | { status: "error"; message: string };

export async function pushPostToRemote(postId: number): Promise<PushResult> {
  const baseUrl = process.env.REMOTE_SYNC_URL?.replace(/\/+$/, "");
  const token = process.env.SYNC_API_TOKEN;
  if (!baseUrl) return { status: "skipped", reason: "REMOTE_SYNC_URL not set (running on prod?)" };
  if (!token) return { status: "skipped", reason: "SYNC_API_TOKEN not set" };

  const [p] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!p) return { status: "error", message: `post ${postId} not found` };

  const ptRows = await db.select().from(postTags).where(eq(postTags.postId, postId));
  const tagIds = ptRows.map((r) => r.tagId);
  const tagSlugs: string[] = [];
  if (tagIds.length) {
    const tagRows = await db.select().from(tags);
    const map = new Map(tagRows.map((t) => [t.id, t.slug]));
    for (const id of tagIds) {
      const slug = map.get(id);
      if (slug) tagSlugs.push(slug);
    }
  }

  let categorySlug: string | null = null;
  if (p.categoryId != null) {
    const [c] = await db.select().from(categories).where(eq(categories.id, p.categoryId)).limit(1);
    categorySlug = c?.slug ?? null;
  }

  let authorEmail: string | null = null;
  if (p.authorId != null) {
    const [u] = await db.select().from(users).where(eq(users.id, p.authorId)).limit(1);
    authorEmail = u?.email ?? null;
  }

  const payload = {
    posts: [
      {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        contentHtml: p.contentHtml,
        status: p.status,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        seoKeywords: p.seoKeywords,
        ogImage: p.ogImage,
        canonicalUrl: p.canonicalUrl,
        noIndex: p.noIndex,
        featuredImage: p.featuredImage,
        readingTime: p.readingTime,
        featured: p.featured ?? false,
        authorEmail,
        categorySlug,
        tagSlugs,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      },
    ],
  };

  const res = await fetch(`${baseUrl}/api/admin/sync/posts`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) return { status: "error", message: `${res.status}: ${body.slice(0, 300)}` };
  return { status: "ok", httpStatus: res.status, body: body.slice(0, 300) };
}
