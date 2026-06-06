/**
 * In-process cron scheduler. Boots from `instrumentation.ts` and reads the
 * weekly-blog config from the `settings` table. Re-armable at runtime by
 * `reloadScheduler()` so the admin UI's save action takes effect without
 * a redeploy.
 */
import cron, { type ScheduledTask } from "node-cron";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { runWeeklyBlogJob } from "@/lib/blog-jobs/weekly-blog";
import { runFullSync } from "@/lib/sync-jobs/full-sync";

/**
 * Idempotent CREATE TABLE IF NOT EXISTS for tables this feature owns. The
 * Dockerfile builds run `db:migrate` but there are no committed migrations,
 * so production never picks up `blog_schedule_runs` from drizzle alone.
 * Running these on boot keeps the admin page from crashing on first deploy.
 */
async function ensureTables(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "blog_schedule_runs" (
        "id" serial PRIMARY KEY NOT NULL,
        "run_at" timestamp DEFAULT now() NOT NULL,
        "trigger" varchar(16) NOT NULL,
        "status" varchar(16) NOT NULL,
        "video_id" varchar(32),
        "video_title" text,
        "video_url" text,
        "post_id" integer REFERENCES posts(id) ON DELETE SET NULL,
        "post_slug" varchar(255),
        "duration_ms" integer,
        "error_message" text
      )
    `);
  } catch (err) {
    console.error("[scheduler] ensureTables failed:", err);
  }
}

type GlobalSched = typeof globalThis & {
  __weeklyBlogTask?: ScheduledTask | null;
  __dbSyncTask?: ScheduledTask | null;
  __schedulerStarted?: boolean;
};
const g = globalThis as GlobalSched;

async function getSettingString(key: string, fallback: string): Promise<string> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (!row) return fallback;
  const v = row.value as unknown;
  return typeof v === "string" ? v : fallback;
}

async function getBoolSetting(key: string, fallback: boolean): Promise<boolean> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (!row) return fallback;
  const v = row.value as unknown;
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return fallback;
}

async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as object })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as object, updatedAt: new Date() },
    });
}

function stopTask(task: ScheduledTask | null | undefined): void {
  if (!task) return;
  try {
    task.stop();
  } catch {
    /* ignore */
  }
}

export type SchedulerStatus = {
  weeklyBlog: { enabled: boolean; cron: string };
  dbSync: { enabled: boolean; cron: string };
};

async function reloadWeeklyBlog(): Promise<{ enabled: boolean; cron: string }> {
  stopTask(g.__weeklyBlogTask);
  g.__weeklyBlogTask = null;
  const enabled = await getBoolSetting("blog_schedule_enabled", false);
  const expr = (await getSettingString("blog_schedule_cron", "0 9 * * 0")).trim();
  if (!enabled) {
    console.log("[scheduler] weekly-blog DISABLED");
    return { enabled: false, cron: expr };
  }
  if (!cron.validate(expr)) {
    console.error(`[scheduler] weekly-blog invalid cron "${expr}" — not scheduling`);
    return { enabled: false, cron: expr };
  }
  g.__weeklyBlogTask = cron.schedule(
    expr,
    async () => {
      console.log(`[scheduler] weekly-blog cron fired (${expr})`);
      try {
        const result = await runWeeklyBlogJob({ trigger: "cron" });
        console.log(`[scheduler] weekly-blog result: ${result.status} — ${result.message}`);
      } catch (err) {
        console.error("[scheduler] weekly-blog crashed:", err);
      }
    },
    { timezone: "Asia/Singapore" },
  );
  console.log(`[scheduler] weekly-blog ARMED — cron="${expr}" (Asia/Singapore)`);
  return { enabled: true, cron: expr };
}

async function reloadDbSync(): Promise<{ enabled: boolean; cron: string }> {
  stopTask(g.__dbSyncTask);
  g.__dbSyncTask = null;
  // Default: enabled on, hourly. On production REMOTE_SYNC_URL is unset so the
  // job no-ops, so it's safe to leave the task armed everywhere.
  const enabled = await getBoolSetting("db_sync_enabled", true);
  const expr = (await getSettingString("db_sync_cron", "0 * * * *")).trim();
  if (!enabled) {
    console.log("[scheduler] db-sync DISABLED");
    return { enabled: false, cron: expr };
  }
  if (!cron.validate(expr)) {
    console.error(`[scheduler] db-sync invalid cron "${expr}" — not scheduling`);
    return { enabled: false, cron: expr };
  }
  g.__dbSyncTask = cron.schedule(
    expr,
    async () => {
      console.log(`[scheduler] db-sync cron fired (${expr})`);
      try {
        const result = await runFullSync("cron");
        await setSetting("db_sync_last_run", {
          at: new Date().toISOString(),
          ...result,
        });
        console.log(
          `[scheduler] db-sync result: ${result.status} posts=${result.postsUpserted} pages=${result.pagesUpserted} ms=${result.durationMs} ${result.message}`,
        );
      } catch (err) {
        console.error("[scheduler] db-sync crashed:", err);
        await setSetting("db_sync_last_run", {
          at: new Date().toISOString(),
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    { timezone: "Asia/Singapore" },
  );
  console.log(`[scheduler] db-sync ARMED — cron="${expr}" (Asia/Singapore)`);
  return { enabled: true, cron: expr };
}

export async function reloadScheduler(): Promise<SchedulerStatus> {
  const [weeklyBlog, dbSync] = await Promise.all([reloadWeeklyBlog(), reloadDbSync()]);
  return { weeklyBlog, dbSync };
}

export async function startScheduler(): Promise<void> {
  if (g.__schedulerStarted) {
    console.log("[scheduler] already started — reloading");
  } else {
    g.__schedulerStarted = true;
    console.log("[scheduler] starting");
    await ensureTables();
  }
  await reloadScheduler();
}
