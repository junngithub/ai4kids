import { db } from "@/db";
import { settings } from "@/db/schema";
import { saveDbSync, runSyncNow } from "./actions";

export const dynamic = "force-dynamic";

type LastRun = {
  at?: string;
  status?: string;
  trigger?: string;
  postsUpserted?: number;
  pagesUpserted?: number;
  durationMs?: number;
  message?: string;
};

async function getSettingsMap(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return fallback;
}

export default async function DbSyncSettings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const flag =
    typeof params.ran === "string" ? params.ran : typeof params.saved === "string" ? "saved" : "";

  const map = await getSettingsMap();
  const cfg = {
    enabled: asBool(map.db_sync_enabled, true),
    cron: asString(map.db_sync_cron, "0 * * * *"),
    lastRun: (map.db_sync_last_run as LastRun | undefined) ?? null,
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold">Database Sync (local → production)</h2>
        <p className="text-sm text-(--color-muted) mt-1">
          Hourly job that pushes every row of <code>posts</code> (with TipTap content JSON,
          rendered HTML, tags, category, featured image) and <code>pages</code> to{" "}
          <code>{(process.env.REMOTE_SYNC_URL ?? "REMOTE_SYNC_URL").replace(/^https?:\/\//, "")}/api/admin/sync/*</code>{" "}
          using <code>SYNC_API_TOKEN</code>. Images are not copied — they already live in the shared
          R2 bucket and resolve the same in both environments. On the production container itself,
          the job no-ops (REMOTE_SYNC_URL is unset there).
        </p>
        {flag === "saved" && <p className="text-xs text-(--color-green) mt-2">Saved.</p>}
        {flag === "1" && <p className="text-xs text-(--color-green) mt-2">Sync complete.</p>}
        {flag === "skip" && <p className="text-xs text-(--color-amber) mt-2">Sync skipped — see status below.</p>}
        {flag === "err" && <p className="text-xs text-red-400 mt-2">Sync errored — see status below.</p>}
      </div>

      <form action={saveDbSync} className="glass p-6 space-y-5 mb-6">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={cfg.enabled}
            className="w-4 h-4 accent-(--color-cyan)"
          />
          <span className="text-sm">
            Enabled <span className="text-(--color-muted)">(default ON)</span> — when off, no cron
            is registered. Manual runs still work.
          </span>
        </label>
        <label className="block">
          <span className="kicker block mb-2">Cron expression (Asia/Singapore)</span>
          <input
            name="cron"
            defaultValue={cfg.cron}
            className="w-full px-4 py-3 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition font-mono text-sm"
          />
          <span className="block text-xs text-(--color-muted) mt-1">
            Default <code>0 * * * *</code> — top of every hour. Use <code>*/5 * * * *</code> for a
            5-minute smoke test.
          </span>
        </label>
        <div className="pt-2">
          <button className="btn-primary">Save</button>
        </div>
      </form>

      <form action={runSyncNow} className="mb-8">
        <button className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-sm transition">
          Run sync now (manual)
        </button>
      </form>

      <div className="glass p-6">
        <h3 className="font-display font-semibold mb-3">Last run</h3>
        {!cfg.lastRun ? (
          <p className="text-sm text-(--color-muted)">
            No run yet — hit "Run sync now" to smoke test.
          </p>
        ) : (
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-(--color-muted)">At</dt>
            <dd className="font-mono text-xs">{cfg.lastRun.at ?? "—"}</dd>
            <dt className="text-(--color-muted)">Status</dt>
            <dd>
              <span
                className={
                  cfg.lastRun.status === "ok"
                    ? "text-(--color-green)"
                    : cfg.lastRun.status === "skipped"
                    ? "text-(--color-amber)"
                    : "text-red-400"
                }
              >
                {cfg.lastRun.status ?? "—"}
              </span>{" "}
              <span className="text-(--color-muted) text-xs">({cfg.lastRun.trigger ?? "—"})</span>
            </dd>
            <dt className="text-(--color-muted)">Posts upserted</dt>
            <dd className="font-mono">{cfg.lastRun.postsUpserted ?? "—"}</dd>
            <dt className="text-(--color-muted)">Pages upserted</dt>
            <dd className="font-mono">{cfg.lastRun.pagesUpserted ?? "—"}</dd>
            <dt className="text-(--color-muted)">Duration</dt>
            <dd className="font-mono">{cfg.lastRun.durationMs ?? "—"} ms</dd>
            <dt className="text-(--color-muted)">Message</dt>
            <dd className="text-xs">{cfg.lastRun.message ?? "—"}</dd>
          </dl>
        )}
      </div>
    </div>
  );
}
