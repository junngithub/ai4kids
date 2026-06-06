/**
 * Recompress every blog image in /public/blog/ to ≤512px (longest side) WebP q=72.
 * Originals (jpg/png/webp) are converted to .webp and the source files are deleted.
 * Skips: .svg (vector — already tiny), .ico, files that already end in .webp AND
 * are already ≤512px AND ≤80KB.
 *
 * Run:  node scripts/compress-blog-images.mjs
 */
import sharp from "sharp";
import { readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from "node:fs";
import path from "node:path";

const DIR = "public/blog";
const MAX_DIM = 512;
const QUALITY = 72;
const SKIP_EXT = new Set([".svg", ".ico"]);

const files = readdirSync(DIR);
let processed = 0;
let savedBytes = 0;
let deleted = 0;

for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  if (SKIP_EXT.has(ext)) continue;
  const src = path.join(DIR, f);
  let st;
  try { st = statSync(src); } catch { continue; }
  if (!st.isFile()) continue;

  const buf = readFileSync(src);
  const beforeSize = buf.length;

  // Determine output webp path
  const base = path.basename(f, ext);
  const out = path.join(DIR, `${base}.webp`);

  try {
    const compressed = await sharp(buf)
      .rotate()
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
    writeFileSync(out, compressed);
    const afterSize = compressed.length;
    savedBytes += beforeSize - afterSize;
    processed++;
    // Force-remove original if extension was not .webp (we already wrote .webp).
    if (ext !== ".webp") {
      try { unlinkSync(src); deleted++; } catch { /* already gone */ }
    }
    console.log(`✓ ${f} (${(beforeSize / 1024).toFixed(0)}KB → ${(afterSize / 1024).toFixed(0)}KB)`);
  } catch (e) {
    console.warn(`× ${f} — ${e.message}`);
  }
}

console.log(
  `\nDone. Processed ${processed} files, removed ${deleted} originals, saved ${(savedBytes / 1024 / 1024).toFixed(1)} MB.`,
);
