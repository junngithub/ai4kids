/**
 * Strip the bold "TL;DR —" label from the lead paragraph of every post,
 * keeping the summary sentence intact. Updates both the TipTap JSON
 * (`content`) and the rendered `contentHtml` cache.
 *
 *   set -a; source .env; set +a; npx tsx scripts/strip-tldr-label.ts [--apply]
 */
import { db } from "../src/db";
import { posts } from "../src/db/schema";
import { eq } from "drizzle-orm";

// Mirror the JSON change in the cached HTML without re-serialising the whole
// doc (some posts use table nodes not in the renderer's extension set).
const HTML_TLDR =
  /<p>\s*<strong>\s*TL;?DR\s*[—–-]?\s*<\/strong>\s*[—–-]?\s*/i;

const APPLY = process.argv.includes("--apply");

function stripTldr(doc: any): boolean {
  const para = doc?.content?.find(
    (n: any) => n.type === "paragraph" && n.content?.length,
  );
  if (!para) return false;
  const content = para.content;
  const first = content[0];
  if (
    first?.type !== "text" ||
    !first.marks?.some((m: any) => m.type === "bold") ||
    !/^\s*TL;?DR\b/i.test(first.text)
  ) {
    return false;
  }
  const remainder = first.text.replace(/^\s*TL;?DR\s*[—–-]?\s*/i, "");
  if (remainder.trim() === "") {
    content.shift();
  } else {
    first.text = remainder;
  }
  // Drop any leftover leading dash / whitespace from the new first text node.
  if (content[0]?.type === "text") {
    content[0].text = content[0].text.replace(/^\s*[—–-]?\s*/, "");
  }
  return true;
}

async function main() {
  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      content: posts.content,
      contentHtml: posts.contentHtml,
    })
    .from(posts);

  let changed = 0;
  for (const r of rows) {
    const doc = r.content as any;
    if (!stripTldr(doc)) continue;
    changed++;
    const html = r.contentHtml ?? "";
    const newHtml = html.replace(HTML_TLDR, "<p>");
    const htmlOk = !html || newHtml !== html;
    console.log(
      `${APPLY ? "FIX " : "WOULD"} #${r.id} ${r.slug}${htmlOk ? "" : "  ⚠ HTML pattern not found"}`,
    );
    if (APPLY) {
      await db
        .update(posts)
        .set({ content: doc, contentHtml: newHtml })
        .where(eq(posts.id, r.id));
    }
  }
  console.log(
    `\n${changed} posts ${APPLY ? "updated" : "would change"} (of ${rows.length}). ${APPLY ? "" : "Re-run with --apply to write."}`,
  );
  process.exit(0);
}
main();
