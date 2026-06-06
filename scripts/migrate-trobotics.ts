/**
 * trobotics WordPress → Postgres blog migration.
 *
 * Reads /tmp/trobotics.sql (decompressed from trobotics_newWp2025.sql.gz),
 * extracts published wp_posts of type 'post', downloads referenced images
 * from https://www.tertiaryrobotics.com, COMPRESSES them via sharp
 * (max 1600px, WebP q=80), rewrites <img src> to local /blog/* paths,
 * inserts into posts + redirects.
 *
 * Run with:
 *   gunzip -kc trobotics_newWp2025.sql.gz > /tmp/trobotics.sql
 *   set -a; source .env; set +a; npx tsx scripts/migrate-trobotics.ts
 */
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import sanitizeHtml from "sanitize-html";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { posts, categories, redirects } from "../src/db/schema";
import { slugify } from "../src/lib/slugify";

const SQL_PATH = process.env.WP_SQL_FILE || "/tmp/trobotics.sql";
const LIVE_HOST = process.env.WP_LIVE_HOST || "https://www.tertiaryrobotics.com";
const IMAGE_DIR = path.join(process.cwd(), "public", "blog");
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 80;

type WpRow = {
  ID: number;
  post_author: number;
  post_date: string;
  post_content: string;
  post_title: string;
  post_excerpt: string;
  post_status: string;
  post_name: string;
  post_type: string;
};

type WpMeta = {
  post_id: number;
  meta_key: string;
  meta_value: string;
};

function unescapeSql(s: string): string {
  return s
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\0/g, "\0");
}

function parseTuple(raw: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < raw.length) {
    while (i < raw.length && /[\s,]/.test(raw[i])) i++;
    if (i >= raw.length) break;
    if (raw[i] === "'") {
      let j = i + 1;
      let value = "";
      while (j < raw.length) {
        if (raw[j] === "\\" && j + 1 < raw.length) {
          value += raw[j] + raw[j + 1];
          j += 2;
          continue;
        }
        if (raw[j] === "'") break;
        value += raw[j];
        j++;
      }
      out.push(unescapeSql(value));
      i = j + 1;
    } else if (raw.slice(i, i + 4).toUpperCase() === "NULL") {
      out.push("");
      i += 4;
    } else {
      let j = i;
      while (j < raw.length && raw[j] !== "," && raw[j] !== ")") j++;
      out.push(raw.slice(i, j).trim());
      i = j;
    }
  }
  return out;
}

function extractInsertRows(sql: string, table: string): string[][] {
  const rows: string[][] = [];
  const re = new RegExp(
    "INSERT INTO `" + table + "` \\([^)]*\\) VALUES\\s*([\\s\\S]*?);\\s*\\n",
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const body = m[1];
    let depth = 0;
    let buf = "";
    let inStr = false;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c === "\\") {
        buf += c + (body[i + 1] ?? "");
        i++;
        continue;
      }
      if (c === "'") inStr = !inStr;
      if (!inStr) {
        if (c === "(") {
          depth++;
          if (depth === 1) {
            buf = "";
            continue;
          }
        } else if (c === ")") {
          depth--;
          if (depth === 0) {
            rows.push(parseTuple(buf));
            buf = "";
            continue;
          }
        }
      }
      buf += c;
    }
  }
  return rows;
}

const SKIP_HOSTS = new Set([
  "data:",
  "blob:",
]);

function shouldDownload(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("data:") || url.startsWith("blob:")) return false;
  // Try to absolutise relative paths
  if (url.startsWith("/")) return true;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function absolutise(url: string): string {
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return LIVE_HOST + url;
  return url;
}

async function downloadAndCompress(rawUrl: string): Promise<string | null> {
  if (!shouldDownload(rawUrl)) return null;
  const url = absolutise(rawUrl);
  try {
    const u = new URL(url);
    // Build a safe local filename — switch to .webp regardless of source ext.
    const originalBase = path.basename(u.pathname);
    const stem = originalBase.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]/gi, "-") || "img";
    const filename = `${stem}.webp`;
    const localPath = path.join(IMAGE_DIR, filename);
    try {
      await stat(localPath);
      return `/blog/${filename}`;
    } catch {
      // not cached — fetch
    }
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  image ${res.status} ${url}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // Compress: resize to max 1600 wide (no enlarge) + webp q=80
    const compressed = await sharp(buf)
      .rotate() // honour EXIF orientation
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    await writeFile(localPath, compressed);
    const savedKB = Math.round(buf.length / 1024);
    const newKB = Math.round(compressed.length / 1024);
    console.log(`  img ✓ ${filename} (${savedKB}KB → ${newKB}KB)`);
    return `/blog/${filename}`;
  } catch (err) {
    console.warn(`  img fail ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function rewriteImages(
  html: string,
): Promise<{ html: string; first?: string }> {
  const re = /(<img[^>]+src=)["']([^"']+)["']/gi;
  const matches: Array<[number, number, string]> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    matches.push([m.index, m.index + m[0].length, m[2]]);
  }
  const unique = Array.from(new Set(matches.map(([, , url]) => url)));
  const downloaded = await Promise.all(
    unique.map(async (url) => [url, await downloadAndCompress(url)] as const),
  );
  const results = new Map<string, string | null>(downloaded);
  let first: string | undefined;
  let out = html;
  for (let i = matches.length - 1; i >= 0; i--) {
    const [start, end, orig] = matches[i];
    const local = results.get(orig);
    if (local) {
      if (!first) first = local;
      out =
        out.slice(0, start) +
        out.slice(start, end).replace(orig, local) +
        out.slice(end);
    }
  }
  return { html: out, first };
}

async function main() {
  console.log(`Reading ${SQL_PATH}…`);
  const sql = await readFile(SQL_PATH, "utf8");
  await mkdir(IMAGE_DIR, { recursive: true });

  const postCols = [
    "ID",
    "post_author",
    "post_date",
    "post_date_gmt",
    "post_content",
    "post_title",
    "post_excerpt",
    "post_status",
    "comment_status",
    "ping_status",
    "post_password",
    "post_name",
    "to_ping",
    "pinged",
    "post_modified",
    "post_modified_gmt",
    "post_content_filtered",
    "post_parent",
    "guid",
    "menu_order",
    "post_type",
    "post_mime_type",
    "comment_count",
  ];
  const metaCols = ["meta_id", "post_id", "meta_key", "meta_value"];

  const rawPosts = extractInsertRows(sql, "wp_posts");
  const rawMeta = extractInsertRows(sql, "wp_postmeta");

  // Build an index of all attachments so we can resolve _thumbnail_id → URL.
  // Attachment rows live in wp_posts with post_type='attachment'; the file
  // URL is the `guid` column (column index 18 in the postCols order).
  const attachmentUrlById = new Map<number, string>();
  for (const cols of rawPosts) {
    if (cols[20] === "attachment" && cols[18]) {
      attachmentUrlById.set(Number(cols[0]), cols[18]);
    }
  }
  console.log(`Indexed ${attachmentUrlById.size} attachments`);

  const all: WpRow[] = rawPosts
    .map((cols) => {
      const obj = Object.fromEntries(
        postCols.map((c, i) => [c, cols[i] ?? ""]),
      ) as unknown as WpRow;
      obj.ID = Number(obj.ID);
      return obj;
    })
    .filter((r) => r.post_status === "publish" && r.post_type === "post");

  const metaByPost = new Map<number, Map<string, string>>();
  for (const cols of rawMeta) {
    const obj = Object.fromEntries(
      metaCols.map((c, i) => [c, cols[i] ?? ""]),
    ) as unknown as WpMeta;
    const pid = Number(obj.post_id);
    if (!metaByPost.has(pid)) metaByPost.set(pid, new Map());
    metaByPost.get(pid)!.set(obj.meta_key, obj.meta_value);
  }

  console.log(`Found ${all.length} published posts in trobotics dump`);

  // Default category
  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "robotics"))
    .limit(1);
  let categoryId: number;
  if (existing) categoryId = existing.id;
  else {
    const [c] = await db
      .insert(categories)
      .values({ slug: "robotics", name: "Robotics" })
      .returning();
    categoryId = c.id;
  }

  let ok = 0;
  let fail = 0;
  for (const row of all) {
    try {
      const meta = metaByPost.get(row.ID) ?? new Map<string, string>();
      const sanitized = sanitizeHtml(row.post_content, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          "img",
          "figure",
          "figcaption",
          "iframe",
          "h1",
          "h2",
          "h3",
          "h4",
        ]),
        allowedAttributes: {
          a: ["href", "name", "target", "rel"],
          img: ["src", "alt", "title", "width", "height"],
          iframe: ["src", "width", "height", "frameborder", "allowfullscreen"],
          "*": ["class"],
        },
        allowedSchemes: ["http", "https", "mailto"],
      });
      const { html: rewritten, first: firstEmbedded } = await rewriteImages(sanitized);

      // Resolve WP featured image (_thumbnail_id → attachment guid → download)
      let featured: string | null = firstEmbedded ?? null;
      const thumbId = Number(meta.get("_thumbnail_id") ?? "");
      if (thumbId && attachmentUrlById.has(thumbId)) {
        const url = attachmentUrlById.get(thumbId)!;
        const local = await downloadAndCompress(url);
        if (local) featured = local;
      }

      const slug = slugify(row.post_name || row.post_title);
      const title = row.post_title || "Untitled";
      const excerpt = row.post_excerpt?.trim() || null;
      const publishedAt = row.post_date
        ? new Date(row.post_date.replace(" ", "T") + "Z")
        : null;
      const seoTitle =
        meta.get("_yoast_wpseo_title") ??
        meta.get("rank_math_title") ??
        null;
      const seoDescription =
        meta.get("_yoast_wpseo_metadesc") ??
        meta.get("rank_math_description") ??
        null;
      const seoKeywords =
        meta.get("_yoast_wpseo_focuskw") ??
        meta.get("rank_math_focus_keyword") ??
        null;

      const tipTapDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "(Imported from Tertiary Robotics WordPress)",
              },
            ],
          },
        ],
      };

      await db
        .insert(posts)
        .values({
          slug,
          title,
          excerpt,
          content: tipTapDoc,
          contentHtml: rewritten,
          status: "published",
          publishedAt,
          featuredImage: featured,
          categoryId,
          seoTitle,
          seoDescription,
          seoKeywords,
        })
        .onConflictDoUpdate({
          target: posts.slug,
          set: {
            title,
            contentHtml: rewritten,
            excerpt,
            featuredImage: featured,
            updatedAt: new Date(),
            categoryId,
          },
        });
      console.log(`✓ /blog/${slug}`);
      ok++;

      // Redirect old WP permalink → new path
      const oldPath = `/${row.post_name}/`;
      const newPath = `/blog/${slug}`;
      if (oldPath !== newPath) {
        await db
          .insert(redirects)
          .values({ fromPath: oldPath, toPath: newPath, statusCode: 301 })
          .onConflictDoNothing();
      }
    } catch (err) {
      console.error(`✗ ${row.post_title}: ${(err as Error).message}`);
      fail++;
    }
  }

  console.log(`\nDone — ${ok} posts imported, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
