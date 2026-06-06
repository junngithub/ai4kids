/**
 * One-off: add the "Corporate Training" tag to 3 case-study blog posts.
 * Run: npx tsx --env-file=.env scripts/add-corporate-training-tag.ts
 * Delete after a successful production push.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { posts, postTags, tags } from "../src/db/schema";

const TAG_NAME = "Corporate Training";
const TAG_SLUG = "corporate-training";
const SLUGS = [
  "charles-and-keith-genai-problem-solving-training-singapore",
  "openclaw-harness-engineering-mindef",
  "kajima-responsible-generative-ai-governance-training-2026",
];

async function main() {
  let tag = await db.query.tags.findFirst({ where: eq(tags.slug, TAG_SLUG) });
  if (!tag) {
    [tag] = await db
      .insert(tags)
      .values({ slug: TAG_SLUG, name: TAG_NAME })
      .returning();
    console.log(`Created tag #${tag.id} ${TAG_NAME}`);
  } else {
    console.log(`Tag exists #${tag.id} ${tag.name}`);
  }

  const rows = await db
    .select({ id: posts.id, slug: posts.slug })
    .from(posts)
    .where(inArray(posts.slug, SLUGS));

  const found = new Set(rows.map((r) => r.slug));
  for (const s of SLUGS) {
    if (!found.has(s)) console.warn(`!! post not found: ${s}`);
  }

  for (const r of rows) {
    await db
      .insert(postTags)
      .values({ postId: r.id, tagId: tag.id })
      .onConflictDoNothing();
    console.log(`Tagged post #${r.id} ${r.slug}`);
  }

  process.exit(0);
}

main();
