/**
 * After compress-blog-images.mjs converts every /public/blog/* to .webp, this
 * script rewrites every post's featuredImage / content / contentHtml so the
 * old .jpg / .png / .gif paths point at the new .webp filenames.
 *
 * Idempotent — running twice does nothing.
 */
import { db } from "../src/db";
import { posts } from "../src/db/schema";
import { eq } from "drizzle-orm";

const EXT_RX = /(\/blog\/[A-Za-z0-9_\-.]+)\.(jpe?g|png|gif)/gi;

function rewrite(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input !== "string") return input as string | null;
  return input.replace(EXT_RX, "$1.webp");
}

async function main() {
  const rows = await db.select().from(posts);
  let touched = 0;
  for (const p of rows) {
    const nextFeatured = rewrite(p.featuredImage);
    const nextContent = rewrite(p.content);
    const nextContentHtml = rewrite(p.contentHtml);
    const changed =
      nextFeatured !== p.featuredImage ||
      nextContent !== p.content ||
      nextContentHtml !== p.contentHtml;
    if (!changed) continue;
    await db
      .update(posts)
      .set({
        featuredImage: nextFeatured,
        content: nextContent ?? "",
        contentHtml: nextContentHtml ?? "",
        updatedAt: new Date(),
      })
      .where(eq(posts.id, p.id));
    touched++;
  }
  console.log(`Rewrote image URLs in ${touched}/${rows.length} posts.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
