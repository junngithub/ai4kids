/**
 * One-shot: strip " | Tertiary Infotech Academy" suffix from seoTitle on
 * posts and pages — the suffix is added automatically by Next's title.template.
 */
import { db } from "../src/db";
import { posts, pages } from "../src/db/schema";
import { eq, like } from "drizzle-orm";

const SUFFIX_RE = /\s*\|\s*Tertiary Infotech Academy\s*$/;

async function main() {
  for (const table of [posts, pages] as const) {
    const rows = await db.select().from(table).where(like(table.seoTitle, "%Tertiary Infotech Academy%"));
    let touched = 0;
    for (const r of rows) {
      const t = (r as { seoTitle: string | null }).seoTitle;
      if (!t) continue;
      const stripped = t.replace(SUFFIX_RE, "").trim();
      if (stripped === t) continue;
      await db.update(table).set({ seoTitle: stripped, updatedAt: new Date() }).where(eq(table.id, (r as { id: number }).id));
      touched++;
    }
    console.log(`${table === posts ? "posts" : "pages"}: stripped suffix on ${touched} rows`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
