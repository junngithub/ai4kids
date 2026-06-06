/**
 * Generate small favicons + apple-touch-icon from public/uploads/tertiary-logo.png.
 * Outputs Next.js App Router conventions:
 *   /public/icon.png        32x32 (browser tab favicon)
 *   /public/icon-192.png   192x192 (Android PWA)
 *   /public/apple-icon.png 180x180 (iOS home screen)
 *   /public/favicon.ico     32x32 (legacy IE/Edge)
 */
import sharp from "sharp";
import { writeFileSync, readFileSync } from "node:fs";

const SOURCE = "public/uploads/tertiary-logo.png";
const src = readFileSync(SOURCE);

const variants = [
  { path: "public/icon.png", size: 32 },
  { path: "public/icon-192.png", size: 192 },
  { path: "public/apple-icon.png", size: 180 },
  { path: "public/favicon.ico", size: 32 },
];

for (const v of variants) {
  const buf = await sharp(src).resize(v.size, v.size).png().toBuffer();
  writeFileSync(v.path, buf);
  console.log(`wrote ${v.path} (${v.size}x${v.size}, ${buf.length} bytes)`);
}
