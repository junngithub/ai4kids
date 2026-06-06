/**
 * Back-fill missing SEO fields on posts + pages.
 *
 * For each published row we populate:
 *   - seoTitle:       falls back to title (clipped to 60 chars + brand)
 *   - seoDescription: falls back to excerpt (clipped to 158 chars). If no
 *                     excerpt, derive from contentHtml stripped of tags.
 *   - seoKeywords:    a small list of keywords derived from the title +
 *                     category name (best-effort, hand-curated phrases get
 *                     priority elsewhere).
 *   - ogImage:        post.featuredImage if present, otherwise /icon-192.png
 *   - canonicalUrl:   /blog/<slug> for posts, /<slug> for pages
 *
 * Idempotent — only touches rows where a target column is NULL/empty.
 */
import { db } from "../src/db";
import { posts, pages, categories } from "../src/db/schema";
import { eq, isNull, or } from "drizzle-orm";

const BRAND = "Tertiary Infotech Academy";
const DEFAULT_OG = "/icon-192.png";

function clip(s: string, max: number): string {
  if (!s) return s;
  const trimmed = s.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  // cut at word boundary
  const slice = trimmed.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim() + "…";
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "the","a","an","and","or","but","for","with","of","in","on","to","from","by",
  "is","are","was","were","be","been","being","this","that","these","those","it",
  "as","at","into","over","your","you","our","we","their","they","them","us","i",
  "how","what","when","where","why","which","who","whom","do","does","did","can",
  "could","should","would","may","might","will","shall","than","then","also",
  "more","most","some","any","all","not","no","yes","new","one","two","three",
  "vs","using","use","used","make","made","get","got","best","top","guide",
]);

function deriveKeywords(title: string, extras: string[]): string {
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t) && t.length > 2);
  // build phrases by sliding windows of 2
  const phrases: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    phrases.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  const set = new Set<string>();
  for (const e of extras) if (e) set.add(e.toLowerCase());
  for (const p of phrases) {
    if (set.size >= 7) break;
    set.add(p);
  }
  for (const t of tokens) {
    if (set.size >= 8) break;
    set.add(t);
  }
  return Array.from(set).slice(0, 8).join(", ");
}

async function main() {
  // ---- POSTS ----
  const cats = await db.select().from(categories);
  const catById = new Map(cats.map((c) => [c.id, c]));

  const postRows = await db
    .select()
    .from(posts)
    .where(
      or(
        isNull(posts.seoTitle),
        isNull(posts.seoDescription),
        isNull(posts.seoKeywords),
        isNull(posts.ogImage),
        isNull(posts.canonicalUrl),
      ),
    );

  let pTitle = 0, pDesc = 0, pKw = 0, pOg = 0, pCanon = 0;
  for (const p of postRows) {
    const patch: Record<string, string | null> = {};
    if (!p.seoTitle) {
      // Brand suffix is applied by Next's title.template in layout.tsx
      patch.seoTitle = clip(p.title, 60);
      pTitle++;
    }
    if (!p.seoDescription) {
      const base = (p.excerpt && p.excerpt.trim()) || stripHtml(p.contentHtml);
      if (base) {
        patch.seoDescription = clip(base, 158);
        pDesc++;
      }
    }
    if (!p.seoKeywords) {
      const cat = p.categoryId ? catById.get(p.categoryId) : undefined;
      patch.seoKeywords = deriveKeywords(p.title, [
        cat?.name?.toLowerCase() ?? "",
        "Singapore",
        "Tertiary Infotech Academy",
      ]);
      pKw++;
    }
    if (!p.ogImage) {
      patch.ogImage = p.featuredImage || DEFAULT_OG;
      pOg++;
    }
    if (!p.canonicalUrl) {
      patch.canonicalUrl = `/blog/${p.slug}`;
      pCanon++;
    }
    if (Object.keys(patch).length === 0) continue;
    await db
      .update(posts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(posts.id, p.id));
  }
  console.log(`posts: ${postRows.length} rows touched`);
  console.log(`  seoTitle:${pTitle} seoDescription:${pDesc} seoKeywords:${pKw} ogImage:${pOg} canonicalUrl:${pCanon}`);

  // ---- PAGES ----
  const pageRows = await db
    .select()
    .from(pages)
    .where(
      or(
        isNull(pages.seoTitle),
        isNull(pages.seoDescription),
        isNull(pages.seoKeywords),
        isNull(pages.ogImage),
        isNull(pages.canonicalUrl),
      ),
    );

  let gTitle = 0, gDesc = 0, gKw = 0, gOg = 0, gCanon = 0;
  for (const pg of pageRows) {
    const patch: Record<string, string | null> = {};
    if (!pg.seoTitle) {
      patch.seoTitle = clip(pg.title, 60);
      gTitle++;
    }
    if (!pg.seoDescription) {
      const base = (pg.excerpt && pg.excerpt.trim()) || stripHtml(pg.contentHtml);
      if (base) {
        patch.seoDescription = clip(base, 158);
        gDesc++;
      }
    }
    if (!pg.seoKeywords) {
      patch.seoKeywords = deriveKeywords(pg.title, [
        "Singapore",
        "Tertiary Infotech Academy",
      ]);
      gKw++;
    }
    if (!pg.ogImage) {
      patch.ogImage = DEFAULT_OG;
      gOg++;
    }
    if (!pg.canonicalUrl) {
      patch.canonicalUrl = `/${pg.slug}`;
      gCanon++;
    }
    if (Object.keys(patch).length === 0) continue;
    await db
      .update(pages)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(pages.id, pg.id));
  }
  console.log(`pages: ${pageRows.length} rows touched`);
  console.log(`  seoTitle:${gTitle} seoDescription:${gDesc} seoKeywords:${gKw} ogImage:${gOg} canonicalUrl:${gCanon}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
