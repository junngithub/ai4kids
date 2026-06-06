/**
 * Re-render every published post's cover image using the current SVG card
 * design and upload to R2. Updates posts.featuredImage to the new URL.
 *
 * Usage:  npm run regen:covers          # all published posts
 *         npm run regen:covers -- 48    # specific post id(s)
 */
import { db } from "../src/db";
import { posts, categories } from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getR2Config } from "../src/lib/r2";
import { renderAndUploadCover } from "../src/lib/post-cover";

async function main() {
  const ids = process.argv
    .slice(2)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));

  const r2 = await getR2Config();
  if (!r2) {
    console.error("R2 not configured — set R2_* env vars or save in /admin/settings/credentials");
    process.exit(1);
  }

  const rows = ids.length
    ? await db.select().from(posts).where(inArray(posts.id, ids))
    : await db.select().from(posts).where(eq(posts.status, "published"));

  if (rows.length === 0) {
    console.log("No posts to regenerate.");
    return;
  }

  const allCats = await db.select().from(categories);
  const catById = new Map(allCats.map((c) => [c.id, c]));

  console.log(`Regenerating ${rows.length} cover${rows.length === 1 ? "" : "s"}…`);
  let ok = 0;
  let fail = 0;
  for (const p of rows) {
    const cat = p.categoryId ? catById.get(p.categoryId) : undefined;
    const kicker = cat?.name?.toLowerCase();
    try {
      const { url, bytes } = await renderAndUploadCover(r2, p.title, p.slug, kicker);
      await db
        .update(posts)
        .set({ featuredImage: url, updatedAt: new Date() })
        .where(eq(posts.id, p.id));
      ok++;
      console.log(`  [${p.id}] ${p.slug} — ${Math.round(bytes / 1024)} KB`);
    } catch (e) {
      fail++;
      console.error(`  [${p.id}] ${p.slug} FAILED:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`Done. ${ok} updated, ${fail} failed.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
