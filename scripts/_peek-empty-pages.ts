import { db } from "../src/db";
import { pages } from "../src/db/schema";

async function main() {
  const all = await db.select({
    id: pages.id,
    slug: pages.slug,
    title: pages.title,
    status: pages.status,
    contentHtml: pages.contentHtml,
  }).from(pages);
  const empty = all.filter((p) => !p.contentHtml || p.contentHtml.replace(/<[^>]+>/g, "").trim().length < 50);
  console.log(`Total pages: ${all.length}`);
  console.log(`Empty/near-empty pages: ${empty.length}`);
  console.log();
  console.log("Sample slugs (first 30):");
  for (const p of empty.slice(0, 30)) console.log(`  ${p.status.padEnd(10)} ${p.slug}`);
}
main().then(() => process.exit(0));
