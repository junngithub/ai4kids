import { db } from "../src/db";
import { posts } from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";

const FEATURED_SLUGS = [
  "charles-and-keith-genai-problem-solving-training-singapore",
  "openclaw-vs-hermes-vs-paperclip-ai-agent-comparison",
  "how-claude-code-is-transforming-software-development",
  "kajima-responsible-generative-ai-governance-training-2026",
  "openclaw-harness-engineering-mindef",
];

async function main() {
  // Clear existing featured first so we don't leave stragglers
  await db.update(posts).set({ featured: false }).where(eq(posts.featured, true));

  const rows = await db
    .update(posts)
    .set({ featured: true, updatedAt: new Date() })
    .where(inArray(posts.slug, FEATURED_SLUGS))
    .returning({ id: posts.id, slug: posts.slug });

  for (const r of rows) console.log(`★ #${r.id} ${r.slug}`);
  console.log(`Featured ${rows.length}/${FEATURED_SLUGS.length} posts.`);
}
main().then(() => process.exit(0));
