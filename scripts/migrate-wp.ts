/**
 * Phase 4: WordPress → Postgres CMS migration.
 *
 * Parses tertiar2_newTIWp2025.sql, extracts wp_posts (post / page) + their meta,
 * downloads referenced images from www.tertiaryinfotech.com into public/blog/,
 * rewrites <img src> to local paths, and inserts into pages/posts/redirects.
 *
 * Run with: pnpm migrate:wp
 */
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/db";
import {
  posts,
  pages,
  categories,
  redirects,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "../src/lib/slugify";
import sanitizeHtml from "sanitize-html";

const SQL_PATH = path.join(process.cwd(), "tertiar2_newTIWp2025.sql");
const LIVE_HOST = "https://www.tertiaryinfotech.com";
const IMAGE_DIR = path.join(process.cwd(), "public", "blog");

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

/** Tokenises a single VALUES (...) tuple from a MySQL dump. */
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
  // Find INSERT INTO `table` ... VALUES (..),(..);
  const rows: string[][] = [];
  const re = new RegExp(
    "INSERT INTO `" + table + "` \\([^)]*\\) VALUES\\s*([\\s\\S]*?);\\s*\\n",
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const body = m[1];
    // Split by ),( while respecting strings
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

async function downloadImage(url: string): Promise<string | null> {
  try {
    const u = new URL(url);
    const filename = path.basename(u.pathname);
    const localPath = path.join(IMAGE_DIR, filename);
    try {
      await stat(localPath);
      return `/blog/${filename}`;
    } catch {
      // not cached
    }
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  image ${res.status} ${url}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(localPath, buf);
    return `/blog/${filename}`;
  } catch (err) {
    console.warn(`  image fail ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function rewriteImages(html: string): Promise<{ html: string; first?: string }> {
  const re = /(<img[^>]+src=)["']([^"']+)["']/gi;
  const matches: Array<[number, number, string]> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    matches.push([m.index, m.index + m[0].length, m[2]]);
  }
  const unique = Array.from(new Set(matches.map(([, , url]) => url)));
  const downloaded = await Promise.all(
    unique.map(async (url) => [url, await downloadImage(url)] as const),
  );
  const results = new Map<string, string | null>(downloaded);
  let first: string | undefined;
  let out = html;
  // Replace from the end to keep indices valid
  for (let i = matches.length - 1; i >= 0; i--) {
    const [start, end, orig] = matches[i];
    const local = results.get(orig);
    if (local) {
      if (!first) first = local;
      out = out.slice(0, start) + out.slice(start, end).replace(orig, local) + out.slice(end);
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

  const all: WpRow[] = rawPosts
    .map((cols) => {
      const obj = Object.fromEntries(
        postCols.map((c, i) => [c, cols[i] ?? ""]),
      ) as unknown as WpRow;
      obj.ID = Number(obj.ID);
      return obj;
    })
    .filter(
      (r) =>
        r.post_status === "publish" &&
        (r.post_type === "post" || r.post_type === "page"),
    );

  const metaByPost = new Map<number, Map<string, string>>();
  for (const cols of rawMeta) {
    const obj = Object.fromEntries(
      metaCols.map((c, i) => [c, cols[i] ?? ""]),
    ) as unknown as WpMeta;
    const pid = Number(obj.post_id);
    if (!metaByPost.has(pid)) metaByPost.set(pid, new Map());
    metaByPost.get(pid)!.set(obj.meta_key, obj.meta_value);
  }

  console.log(`Found ${all.length} published posts/pages`);

  // Ensure a default category
  let defaultCatId: number;
  const [existingCat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "uncategorised"))
    .limit(1);
  if (existingCat) defaultCatId = existingCat.id;
  else {
    const [c] = await db
      .insert(categories)
      .values({ slug: "uncategorised", name: "Uncategorised" })
      .returning();
    defaultCatId = c.id;
  }

  for (const row of all) {
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
    const { html: rewritten, first } = await rewriteImages(sanitized);

    const slug = slugify(row.post_name || row.post_title);
    const title = row.post_title || "Untitled";
    const excerpt = row.post_excerpt?.trim() || null;
    const publishedAt = row.post_date ? new Date(row.post_date.replace(" ", "T") + "Z") : null;

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
          content: [{ type: "text", text: "(Imported from WordPress)" }],
        },
      ],
    };

    if (row.post_type === "page") {
      await db
        .insert(pages)
        .values({
          slug,
          title,
          excerpt,
          content: tipTapDoc,
          contentHtml: rewritten,
          status: "published",
          publishedAt,
          seoTitle,
          seoDescription,
          seoKeywords,
        })
        .onConflictDoUpdate({
          target: pages.slug,
          set: { title, contentHtml: rewritten, excerpt, updatedAt: new Date() },
        });
      console.log(`  page ✓ /${slug}`);
    } else {
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
          featuredImage: first ?? null,
          categoryId: defaultCatId,
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
            featuredImage: first ?? null,
            updatedAt: new Date(),
          },
        });
      console.log(`  post ✓ /blog/${slug}`);
    }

    // Preserve old WP permalink → new path
    const oldPath = `/${row.post_name}/`;
    const newPath = row.post_type === "page" ? `/${slug}` : `/blog/${slug}`;
    if (oldPath !== newPath) {
      await db
        .insert(redirects)
        .values({ fromPath: oldPath, toPath: newPath, statusCode: 301 })
        .onConflictDoNothing();
    }
  }

  console.log("Migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
