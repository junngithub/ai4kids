import { sql } from "drizzle-orm";
import { db } from "@/db";

async function main() {
  // Idempotent: create enum + column if not present.
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE category_type AS ENUM ('page', 'post');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await db.execute(sql`
    ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS "type" category_type NOT NULL DEFAULT 'post';
  `);

  // Backfill: any category that is used by pages but never by posts → 'page'.
  await db.execute(sql`
    WITH usage AS (
      SELECT c.id,
             SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) AS page_count,
             SUM(CASE WHEN po.id IS NOT NULL THEN 1 ELSE 0 END) AS post_count
      FROM categories c
      LEFT JOIN pages p  ON p.category_id  = c.id
      LEFT JOIN posts po ON po.category_id = c.id
      GROUP BY c.id
    )
    UPDATE categories c
       SET "type" = 'page'
      FROM usage u
     WHERE u.id = c.id
       AND u.page_count > 0
       AND u.post_count = 0;
  `);

  // Ensure curated page-type categories exist.
  for (const [slug, name] of [
    ["portfolio", "Portfolio"],
    ["bespoke-apps", "Bespoke Apps"],
    ["general", "General"],
  ] as const) {
    await db.execute(sql`
      INSERT INTO categories (slug, name, "type")
      VALUES (${slug}, ${name}, 'page')
      ON CONFLICT (slug) DO UPDATE SET "type" = 'page';
    `);
  }

  const after = await db.execute(sql`SELECT id, slug, name, "type" FROM categories ORDER BY "type", name`);
  console.log("Categories after migration:");
  console.table(after.rows ?? after);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
