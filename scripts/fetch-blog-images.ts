import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../src/db";
import { posts } from "../src/db/schema";

const LIVE = "https://www.tertiaryinfotech.com";
const BLOG_DIR = path.resolve(process.cwd(), "public/blog");

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "TertiaryCMS-MigrationBot/1.0" },
      redirect: "follow",
    });
    if (!r.ok) {
      console.warn(`  ✗ ${url} → HTTP ${r.status}`);
      return null;
    }
    return await r.text();
  } catch (e) {
    console.warn(`  ✗ ${url} → ${(e as Error).message}`);
    return null;
  }
}

function findFeaturedImage(html: string): string | null {
  // 1) og:image
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og && og[1].includes("/wp-content/uploads/")) return og[1];

  // 2) twitter:image
  const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (tw && tw[1].includes("/wp-content/uploads/")) return tw[1];

  // 3) First wp-content upload image in the article body
  const m = html.match(
    /https?:\/\/[^"' )]+\/wp-content\/uploads\/[^"' )]+?\.(?:png|jpg|jpeg|webp|gif)/i,
  );
  return m ? m[0] : null;
}

async function downloadImage(url: string): Promise<string | null> {
  try {
    const filename = decodeURIComponent(path.basename(new URL(url).pathname));
    const target = path.join(BLOG_DIR, filename);
    try {
      const st = await fs.stat(target);
      if (st.size > 0) return `/blog/${filename}`; // already cached
    } catch {
      /* not present */
    }
    const r = await fetch(url);
    if (!r.ok) {
      console.warn(`    ✗ image HTTP ${r.status} ${url}`);
      return null;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    await fs.writeFile(target, buf);
    return `/blog/${filename}`;
  } catch (e) {
    console.warn(`    ✗ download ${url} → ${(e as Error).message}`);
    return null;
  }
}

async function main() {
  await fs.mkdir(BLOG_DIR, { recursive: true });
  const all = await db
    .select({ id: posts.id, slug: posts.slug, featuredImage: posts.featuredImage })
    .from(posts);

  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  let updated = 0;
  let skipped = 0;
  let failed: string[] = [];

  for (const p of all) {
    if (p.featuredImage && !force) {
      skipped++;
      continue;
    }
    const url = `${LIVE}/${p.slug}.html`;
    console.log(`→ ${p.slug}`);
    const html = await fetchHtml(url);
    if (!html) {
      failed.push(p.slug);
      continue;
    }
    const imgUrl = findFeaturedImage(html);
    if (!imgUrl) {
      console.warn(`  ✗ no wp-content image found`);
      failed.push(p.slug);
      continue;
    }
    console.log(`  img ${imgUrl}`);
    const localPath = await downloadImage(imgUrl);
    if (!localPath) {
      failed.push(p.slug);
      continue;
    }
    if (!dryRun) {
      await db.update(posts).set({ featuredImage: localPath }).where(eq(posts.id, p.id));
    }
    console.log(`  ✓ saved → ${localPath}`);
    updated++;
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped} failed=${failed.length}`);
  if (failed.length) console.log("Failed slugs:", failed.join(", "));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
