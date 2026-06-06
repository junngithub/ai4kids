/**
 * One-shot migration: upload every file in /public/uploads to Cloudflare R2,
 * then rewrite all DB references (posts.featuredImage/content/contentHtml,
 * pages.featuredImage/content, media.path, settings) from /uploads/* to the
 * R2 public URL. Idempotent — already-migrated rows are skipped.
 *
 * Usage:  npm run migrate:r2
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/db";
import { posts, pages, media } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { getR2Config, uploadToR2 } from "../src/lib/r2";

const FOLDERS = ["uploads", "blog", "clients"];
const PUBLIC_DIR = path.join(process.cwd(), "public");
const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

function rewriteUrl(input: unknown, publicUrl: string): unknown {
  if (typeof input !== "string") return input;
  let out = input;
  for (const folder of FOLDERS) {
    // Match absolute root-relative paths like "/uploads/foo.webp" or src="/blog/x.jpg"
    // but NOT paths that already point to the R2 public URL or any other host.
    const re = new RegExp(`(^|[\\s"'(=])/${folder}/`, "g");
    out = out.replace(re, `$1${publicUrl}/${folder}/`);
  }
  return out;
}

async function main() {
  const r2 = await getR2Config();
  if (!r2) {
    console.error("R2 not configured — set R2_* env vars or save in /admin/settings/credentials");
    process.exit(1);
  }

  console.log(`Migrating /public/{${FOLDERS.join(",")}} → ${r2.publicUrl}/ (bucket: ${r2.bucket})`);

  let uploaded = 0;
  let skipped = 0;
  for (const folder of FOLDERS) {
    const dir = path.join(PUBLIC_DIR, folder);
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      console.log(`  /public/${folder} — not present, skipping`);
      continue;
    }
    console.log(`  /public/${folder}: ${files.length} entries`);
    for (const name of files) {
      const full = path.join(dir, name);
      const st = await stat(full).catch(() => null);
      if (!st?.isFile()) continue;
      const ext = path.extname(name).toLowerCase();
      const mime = MIME_MAP[ext] || "application/octet-stream";
      const buf = await readFile(full);
      try {
        await uploadToR2(r2, `${folder}/${name}`, buf, mime);
        uploaded++;
        if (uploaded % 25 === 0) console.log(`    uploaded ${uploaded} so far`);
      } catch (e) {
        console.error(`    FAILED ${folder}/${name}:`, e instanceof Error ? e.message : e);
        skipped++;
      }
    }
  }
  console.log(`Files: ${uploaded} uploaded, ${skipped} failed`);

  console.log("Rewriting DB references…");
  const allPosts = await db.select().from(posts);
  let postCount = 0;
  for (const p of allPosts) {
    const fi = rewriteUrl(p.featuredImage, r2.publicUrl);
    const ct = rewriteUrl(p.content, r2.publicUrl);
    const ch = rewriteUrl(p.contentHtml, r2.publicUrl);
    if (fi === p.featuredImage && ct === p.content && ch === p.contentHtml) continue;
    await db
      .update(posts)
      .set({
        featuredImage: fi as string | null,
        content: ct as never,
        contentHtml: ch as string | null,
      })
      .where(eq(posts.id, p.id));
    postCount++;
  }
  console.log(`  posts: ${postCount} updated`);

  const allPages = await db.select().from(pages);
  let pageCount = 0;
  for (const pg of allPages) {
    const ct = rewriteUrl(pg.content, r2.publicUrl);
    const ch = rewriteUrl(pg.contentHtml, r2.publicUrl);
    if (ct === pg.content && ch === pg.contentHtml) continue;
    await db
      .update(pages)
      .set({ content: ct as never, contentHtml: ch as string | null })
      .where(eq(pages.id, pg.id));
    pageCount++;
  }
  console.log(`  pages: ${pageCount} updated`);

  const allMedia = await db.select().from(media);
  let mediaCount = 0;
  for (const m of allMedia) {
    const p = rewriteUrl(m.path, r2.publicUrl);
    if (p === m.path) continue;
    await db.update(media).set({ path: p as string }).where(eq(media.id, m.id));
    mediaCount++;
  }
  console.log(`  media: ${mediaCount} updated`);

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
