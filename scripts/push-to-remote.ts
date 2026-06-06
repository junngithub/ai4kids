/**
 * Push local DB → remote DB via /api/admin/sync/* endpoints.
 *
 * Usage:
 *   REMOTE_SYNC_URL=https://www.tertiaryinfotech.com \
 *   SYNC_API_TOKEN=<token> \
 *   npx tsx scripts/push-to-remote.ts <resource> [...]
 *
 * Resources: menus, settings, taxonomy, pages, posts, all
 *
 * Examples:
 *   npx tsx scripts/push-to-remote.ts menus
 *   npx tsx scripts/push-to-remote.ts settings pages
 *   npx tsx scripts/push-to-remote.ts all
 */

import { eq, asc } from "drizzle-orm";
import { db } from "../src/db";
import {
  menus,
  menuItems,
  settings,
  pages,
  posts,
  categories,
  tags,
  postTags,
  users,
} from "../src/db/schema";

type Resource = "menus" | "settings" | "taxonomy" | "pages" | "posts" | "users";
// `users` is intentionally NOT in ALL — must be explicitly requested.
const ALL: Resource[] = ["menus", "settings", "taxonomy", "pages", "posts"];
// taxonomy must run before posts (FK by slug); users runs first so pages/posts can resolve authors
const ORDER: Resource[] = ["users", "taxonomy", "settings", "menus", "pages", "posts"];

function getEnv() {
  const baseUrl = process.env.REMOTE_SYNC_URL?.replace(/\/$/, "");
  if (!baseUrl)
    throw new Error("REMOTE_SYNC_URL is not set (e.g. https://www.tertiaryinfotech.com)");
  const token = process.env.SYNC_API_TOKEN;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  // Prefer bearer token when configured; otherwise use admin Basic auth.
  let auth: string;
  if (token) {
    auth = `Bearer ${token}`;
  } else if (email && password) {
    auth = `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`;
  } else {
    throw new Error(
      "Auth missing: set SYNC_API_TOKEN, or ADMIN_EMAIL + ADMIN_PASSWORD, in .env",
    );
  }
  return { baseUrl, auth };
}

async function postJson(path: string, body: unknown) {
  const { baseUrl, auth } = getEnv();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${text}`);
  return text;
}

// ---- menus ------------------------------------------------------------------

async function pushMenus() {
  const locations = ["header", "footer"] as const;
  for (const location of locations) {
    const [menu] = await db
      .select()
      .from(menus)
      .where(eq(menus.location, location))
      .limit(1);
    if (!menu) {
      console.log(`  [menus:${location}] skipped (no local menu)`);
      continue;
    }
    const items = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.menuId, menu.id))
      .orderBy(asc(menuItems.sortOrder));
    if (items.length === 0) {
      console.log(`  [menus:${location}] skipped (no items)`);
      continue;
    }
    const res = await postJson("/api/admin/sync/menus", {
      location,
      items: items.map((it) => ({
        label: it.label,
        href: it.href,
        sortOrder: it.sortOrder,
        openInNewTab: it.openInNewTab,
      })),
    });
    console.log(`  [menus:${location}] ${res}`);
  }
}

// ---- settings ---------------------------------------------------------------

async function pushSettings() {
  const rows = await db.select().from(settings);
  if (rows.length === 0) {
    console.log("  [settings] skipped (no rows)");
    return;
  }
  const res = await postJson("/api/admin/sync/settings", {
    entries: rows.map((r) => ({ key: r.key, value: r.value })),
  });
  console.log(`  [settings] ${res}`);
}

// ---- taxonomy (categories + tags) ------------------------------------------

async function pushTaxonomy() {
  const [cats, tagRows] = await Promise.all([
    db.select().from(categories),
    db.select().from(tags),
  ]);
  if (cats.length === 0 && tagRows.length === 0) {
    console.log("  [taxonomy] skipped (no rows)");
    return;
  }
  const res = await postJson("/api/admin/sync/taxonomy", {
    categories: cats.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      type: c.type,
    })),
    tags: tagRows.map((t) => ({ slug: t.slug, name: t.name })),
  });
  console.log(`  [taxonomy] ${res}`);
}

// ---- pages ------------------------------------------------------------------

async function authorEmailById(id: number | null): Promise<string | null> {
  if (id == null) return null;
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u?.email ?? null;
}

async function pushPages() {
  const rows = await db.select().from(pages);
  if (rows.length === 0) {
    console.log("  [pages] skipped (no rows)");
    return;
  }
  const allCats = await db.select().from(categories);
  const catById = new Map(allCats.map((c) => [c.id, c.slug]));
  const payload = [];
  for (const p of rows) {
    payload.push({
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
  // The server caps each request at 200 rows. Chunk to stay under that.
  const CHUNK = 150;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const res = await postJson("/api/admin/sync/pages", { pages: slice });
    console.log(`  [pages] ${i + slice.length}/${payload.length} — ${res}`);
  }
}

// ---- posts ------------------------------------------------------------------

async function pushPosts() {
  const rows = await db.select().from(posts);
  if (rows.length === 0) {
    console.log("  [posts] skipped (no rows)");
    return;
  }
  // Build tag lookup
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
  // Build category lookup
  const cats = await db.select().from(categories);
  const catById = new Map(cats.map((c) => [c.id, c.slug]));

  const payload = [];
  for (const p of rows) {
    payload.push({
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
  const CHUNK = 150;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const res = await postJson("/api/admin/sync/posts", { posts: slice });
    console.log(`  [posts] ${i + slice.length}/${payload.length} — ${res}`);
  }
}

// ---- users ------------------------------------------------------------------

async function pushUsers() {
  const rows = await db.select().from(users);
  if (rows.length === 0) {
    console.log("  [users] skipped (no rows)");
    return;
  }
  // Sync ALL local users — there should only be one or two admin accounts.
  const res = await postJson("/api/admin/sync/users", {
    users: rows.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      passwordHash: u.passwordHash,
    })),
  });
  console.log(`  [users] ${res}`);
}

// ---- dispatcher -------------------------------------------------------------

const HANDLERS: Record<Resource, () => Promise<void>> = {
  users: pushUsers,
  menus: pushMenus,
  settings: pushSettings,
  taxonomy: pushTaxonomy,
  pages: pushPages,
  posts: pushPosts,
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: push-to-remote.ts <resource>... | all");
    console.error(`Resources: ${ALL.join(", ")}, all, users (opt-in)`);
    process.exit(2);
  }
  const requested = new Set<Resource>();
  for (const a of args) {
    if (a === "all") {
      ORDER.forEach((r) => {
        // `all` excludes users by design — pass `users` explicitly to sync them.
        if (r !== "users") requested.add(r);
      });
    } else if (a === "users" || (ALL as readonly string[]).includes(a)) {
      requested.add(a as Resource);
    } else {
      console.error(`Unknown resource: ${a}`);
      process.exit(2);
    }
  }
  // Run in canonical order regardless of CLI arg order
  const toRun = ORDER.filter((r) => requested.has(r));
  const { baseUrl } = getEnv();
  console.log(`→ Pushing to ${baseUrl} — ${toRun.join(", ")}`);
  for (const r of toRun) {
    await HANDLERS[r]();
  }
  console.log("✓ Done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
