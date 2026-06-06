/**
 * Hourly local → remote full sync. Pushes every row in `posts` and `pages`
 * to the production CMS via the existing `/api/admin/sync/*` endpoints.
 *
 * Images: all featured/embedded images live in Cloudflare R2 — a shared
 * CDN bucket consumed by both local and prod. The URL in `featuredImage`
 * resolves identically in both environments, so image "sync" is implicit:
 * pushing the rows is sufficient.
 *
 * No-op on production (REMOTE_SYNC_URL unset).
 */
import { db } from "@/db";
import {
  posts,
  pages,
  postTags,
  tags,
  categories,
  users,
} from "@/db/schema";
import { eq } from "drizzle-orm";

type Trigger = "cron" | "manual";

export type FullSyncResult = {
  status: "ok" | "skipped" | "error";
  trigger: Trigger;
  postsUpserted: number;
  pagesUpserted: number;
  durationMs: number;
  message: string;
};

const CHUNK = 150;

function authHeader(): string | null {
  const token = process.env.SYNC_API_TOKEN;
  return token ? `Bearer ${token}` : null;
}

async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<{ ok: boolean; text: string }> {
  const auth = authHeader();
  if (!auth) return { ok: false, text: "SYNC_API_TOKEN not set" };
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: auth },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, text };
}

async function authorEmailById(id: number | null): Promise<string | null> {
  if (id == null) return null;
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u?.email ?? null;
}

async function buildPostsPayload() {
  const rows = await db.select().from(posts);
  if (rows.length === 0) return [];
  const tagRows = await db.select().from(tags);
  const tagById = new Map(tagRows.map((t) => [t.id, t.slug]));
  const allPostTags = await db.select().from(postTags);
  const tagSlugsByPostId = new Map<number, string[]>();
  for (const pt of allPostTags) {
    const slug = tagById.get(pt.tagId);
    if (!slug) continue;
    const arr = tagSlugsByPostId.get(pt.postId) ?? [];
    arr.push(slug);
    tagSlugsByPostId.set(pt.postId, arr);
  }
  const cats = await db.select().from(categories);
  const catById = new Map(cats.map((c) => [c.id, c.slug]));

  const out = [];
  for (const p of rows) {
    out.push({
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
      authorEmail: await authorEmailById(p.authorId),
      categorySlug: p.categoryId != null ? catById.get(p.categoryId) ?? null : null,
      tagSlugs: tagSlugsByPostId.get(p.id) ?? [],
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
    });
  }
  return out;
}

async function buildPagesPayload() {
  const rows = await db.select().from(pages);
  if (rows.length === 0) return [];
  const cats = await db.select().from(categories);
  const catById = new Map(cats.map((c) => [c.id, c.slug]));

  const out = [];
  for (const p of rows) {
    out.push({
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
      authorEmail: await authorEmailById(p.authorId),
      categorySlug: p.categoryId != null ? catById.get(p.categoryId) ?? null : null,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
    });
  }
  return out;
}

export async function runFullSync(trigger: Trigger): Promise<FullSyncResult> {
  const start = Date.now();
  const baseUrl = process.env.REMOTE_SYNC_URL?.replace(/\/+$/, "");
  if (!baseUrl) {
    return {
      status: "skipped",
      trigger,
      postsUpserted: 0,
      pagesUpserted: 0,
      durationMs: 0,
      message: "REMOTE_SYNC_URL not set (running on prod?)",
    };
  }
  if (!process.env.SYNC_API_TOKEN) {
    return {
      status: "skipped",
      trigger,
      postsUpserted: 0,
      pagesUpserted: 0,
      durationMs: 0,
      message: "SYNC_API_TOKEN not set",
    };
  }

  let postsUpserted = 0;
  let pagesUpserted = 0;
  const errors: string[] = [];

  try {
    const postsPayload = await buildPostsPayload();
    for (let i = 0; i < postsPayload.length; i += CHUNK) {
      const slice = postsPayload.slice(i, i + CHUNK);
      const r = await postJson(baseUrl, "/api/admin/sync/posts", { posts: slice });
      if (!r.ok) {
        errors.push(`posts ${i}: ${r.text.slice(0, 200)}`);
        break;
      }
      postsUpserted += slice.length;
    }

    const pagesPayload = await buildPagesPayload();
    for (let i = 0; i < pagesPayload.length; i += CHUNK) {
      const slice = pagesPayload.slice(i, i + CHUNK);
      const r = await postJson(baseUrl, "/api/admin/sync/pages", { pages: slice });
      if (!r.ok) {
        errors.push(`pages ${i}: ${r.text.slice(0, 200)}`);
        break;
      }
      pagesUpserted += slice.length;
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const durationMs = Date.now() - start;
  if (errors.length) {
    return {
      status: "error",
      trigger,
      postsUpserted,
      pagesUpserted,
      durationMs,
      message: errors.join(" | ").slice(0, 1500),
    };
  }
  return {
    status: "ok",
    trigger,
    postsUpserted,
    pagesUpserted,
    durationMs,
    message: `posts=${postsUpserted} pages=${pagesUpserted}`,
  };
}
