import { NextResponse } from "next/server";
import { db } from "@/db";
import { syncAuthorized } from "@/lib/sync-auth";
import { sql } from "drizzle-orm";

/**
 * Idempotent schema migration runner. Re-applies the column/enum/table
 * additions that drizzle-kit would otherwise apply locally — but on
 * whichever environment is hosting this endpoint. Safe to call multiple
 * times; uses IF NOT EXISTS where supported and ADD VALUE IF NOT EXISTS
 * for enum extensions.
 *
 * POST /api/admin/sync/migrate with bearer or basic auth.
 */
export async function POST(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ran: string[] = [];

  // 1) lead_blocklist table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lead_blocklist (
      id serial PRIMARY KEY,
      pattern varchar(255) NOT NULL,
      kind varchar(16) NOT NULL,
      reason text,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS lead_blocklist_pattern_uq
      ON lead_blocklist (pattern, kind)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS lead_blocklist_kind_idx
      ON lead_blocklist (kind)
  `);
  ran.push("lead_blocklist table + indexes");

  // 2) leads.score
  await db.execute(sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS score integer`);
  ran.push("leads.score column");

  // 3) posts.view_count
  await db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0`);
  ran.push("posts.view_count column");

  // 3b) posts.like_count (reader thumbs-up counter)
  await db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0`);
  ran.push("posts.like_count column");

  // 4) posts.featured
  await db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false`);
  ran.push("posts.featured column");

  // 5) pages.category_id
  await db.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS category_id integer`);
  ran.push("pages.category_id column");

  // 6a) category_type enum + categories.type column
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE category_type AS ENUM ('page', 'post');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `);
  await db.execute(sql`
    ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS "type" category_type NOT NULL DEFAULT 'post'
  `);
  // Backfill: any category used only by pages → 'page'.
  await db.execute(sql`
    WITH usage AS (
      SELECT c.id,
             SUM(CASE WHEN p.id  IS NOT NULL THEN 1 ELSE 0 END) AS page_count,
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
       AND u.post_count = 0
  `);
  // Seed curated page-type categories.
  for (const [slug, name] of [
    ["portfolio", "Portfolio"],
    ["bespoke-apps", "Bespoke Apps"],
    ["general", "General"],
  ] as const) {
    await db.execute(sql`
      INSERT INTO categories (slug, name, "type")
      VALUES (${slug}, ${name}, 'page')
      ON CONFLICT (slug) DO UPDATE SET "type" = 'page'
    `);
  }
  ran.push("categories.type column + backfill + page-type seeds");

  // 7) lead_status enum: add 'follow_up'
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'follow_up'
          AND enumtypid = 'lead_status'::regtype
      ) THEN
        ALTER TYPE lead_status ADD VALUE 'follow_up' BEFORE 'contacted';
      END IF;
    END $$
  `);
  ran.push("lead_status: follow_up");

  // 8) social_posts table + enums (LinkedIn + Facebook auto-posting queue)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE social_platform AS ENUM ('linkedin','facebook');
    EXCEPTION WHEN duplicate_object THEN null; END $$
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE social_post_status AS ENUM
        ('draft','scheduled','publishing','published','failed','cancelled');
    EXCEPTION WHEN duplicate_object THEN null; END $$
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS social_posts (
      id serial PRIMARY KEY,
      post_id integer REFERENCES posts(id) ON DELETE CASCADE,
      platform social_platform NOT NULL,
      status social_post_status NOT NULL DEFAULT 'draft',
      content text NOT NULL,
      image_url text,
      link_url text,
      scheduled_at timestamp,
      published_at timestamp,
      external_id varchar(255),
      external_url text,
      error_message text,
      attempt_count integer NOT NULL DEFAULT 0,
      last_attempt_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS social_posts_status_scheduled_idx
      ON social_posts (status, scheduled_at)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS social_posts_post_id_idx
      ON social_posts (post_id)
  `);
  ran.push("social_posts table + enums + indexes");

  return NextResponse.json({ ok: true, ran });
}
