/**
 * Pre-audit: report on SEO field coverage for posts + pages.
 */
import { db } from "../src/db";
import { posts, pages } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const allPosts = await db.select().from(posts).where(eq(posts.status, "published"));
  const allPages = await db.select().from(pages).where(eq(pages.status, "published"));

  function report(label: string, rows: Array<Record<string, unknown>>) {
    const total = rows.length;
    const missingTitle = rows.filter((r) => !r.seoTitle).length;
    const missingDesc = rows.filter((r) => !r.seoDescription).length;
    const missingKw = rows.filter((r) => !r.seoKeywords).length;
    const missingOg = rows.filter((r) => !r.ogImage).length;
    const missingCanonical = rows.filter((r) => !r.canonicalUrl).length;
    const missingExcerpt = rows.filter((r) => !r.excerpt).length;
    const missingFeatured = rows.filter((r) => !("featuredImage" in r) ? false : !r.featuredImage).length;
    console.log(`${label}: ${total} published`);
    console.log(`  missing seoTitle:       ${missingTitle}`);
    console.log(`  missing seoDescription: ${missingDesc}`);
    console.log(`  missing seoKeywords:    ${missingKw}`);
    console.log(`  missing ogImage:        ${missingOg}`);
    console.log(`  missing canonicalUrl:   ${missingCanonical}`);
    console.log(`  missing excerpt:        ${missingExcerpt}`);
    if (label === "posts") console.log(`  missing featuredImage:  ${missingFeatured}`);
  }
  report("posts", allPosts);
  report("pages", allPages);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
