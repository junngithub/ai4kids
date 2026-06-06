import { db } from "@/db";
import { settings } from "@/db/schema";
import { saveBlogSchedule, runNow } from "./actions";
import { listRecentRuns } from "@/lib/blog-jobs/weekly-blog";

export const dynamic = "force-dynamic";

async function getSettingsMap(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function asBool(v: unknown): boolean {
  return v === true || v === "true";
}

const DEFAULTS = {
  enabled: false,
  autoApprove: true,
  pushToRemote: true,
  cron: "0 9 * * 0",
  channel: "@lev-selector",
  channelId: "",
  authorId: "2",
  categorySlug: "ai-automation",
};

export default async function BlogScheduleSettings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const flag = typeof params.ran === "string" ? params.ran : typeof params.saved === "string" ? "saved" : "";

  const map = await getSettingsMap();
  const cfg = {
    enabled: asBool(map.blog_schedule_enabled ?? DEFAULTS.enabled),
    // Auto-approve defaults to TRUE — flips published immediately on creation.
    autoApprove:
      map.blog_schedule_auto_approve === undefined
        ? DEFAULTS.autoApprove
        : asBool(map.blog_schedule_auto_approve),
    pushToRemote:
      map.blog_schedule_push_to_remote === undefined
        ? DEFAULTS.pushToRemote
        : asBool(map.blog_schedule_push_to_remote),
    cron: asString(map.blog_schedule_cron, DEFAULTS.cron),
    channel: asString(map.blog_schedule_yt_channel, DEFAULTS.channel),
    channelId: asString(map.blog_schedule_yt_channel_id, DEFAULTS.channelId),
    authorId: asString(map.blog_schedule_author_id, DEFAULTS.authorId),
    categorySlug: asString(map.blog_schedule_category_slug, DEFAULTS.categorySlug),
  };
  // Self-heal if the table is missing (first deploy before instrumentation
  // has a chance to run, or a fresh prod DB without migrations).
  let runs: Awaited<ReturnType<typeof listRecentRuns>> = [];
  try {
    runs = await listRecentRuns(20);
  } catch (err) {
    console.warn("[blog-schedule/page] listRecentRuns failed:", err);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold">Weekly Auto-Blog Schedule</h2>
        <p className="text-sm text-(--color-muted) mt-1">
          Every cron tick, the pipeline pulls the latest video from the configured YouTube channel
          (default: Lev Selector's weekly AI roundup), distills the most interesting AI topic, and
          drafts a publish-ready blog post with cover image, internal links and lead-magnet CTAs.
          Sub-agent prompts live in <code className="text-(--color-cyan)">.claude/agents/</code>.
        </p>
        {flag === "saved" && <p className="text-xs text-(--color-green) mt-2">Saved.</p>}
        {flag === "1" && <p className="text-xs text-(--color-green) mt-2">Run complete — see the log below.</p>}
        {flag === "skip" && <p className="text-xs text-(--color-amber) mt-2">Run skipped — see the log below.</p>}
        {flag === "err" && <p className="text-xs text-red-400 mt-2">Run errored — see the log below.</p>}
      </div>

      <form action={saveBlogSchedule} className="glass p-6 space-y-5 mb-8">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={cfg.enabled}
            className="w-4 h-4 accent-(--color-cyan)"
          />
          <span className="text-sm">Enabled — when off, no cron job is registered.</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="auto_approve"
            defaultChecked={cfg.autoApprove}
            className="w-4 h-4 accent-(--color-cyan)"
          />
          <span className="text-sm">
            Auto-approve <span className="text-(--color-muted)">(default ON)</span> — publish the
            generated post immediately. Uncheck to land each run as a draft for manual review.
          </span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="push_to_remote"
            defaultChecked={cfg.pushToRemote}
            className="w-4 h-4 accent-(--color-cyan)"
          />
          <span className="text-sm">
            Push to production <span className="text-(--color-muted)">(default ON)</span> — after a
            local run, mirror the post to <code>REMOTE_SYNC_URL/api/admin/sync/posts</code>. No-op
            when the job runs on production itself (REMOTE_SYNC_URL unset there).
          </span>
        </label>

        <Field
          name="cron"
          label="Cron expression (Asia/Singapore)"
          defaultValue={cfg.cron}
          hint='Default 0 9 * * 0 — Sunday 09:00 SGT. Use "* * * * *" to fire every minute for smoke tests.'
          mono
        />
        <Field
          name="channel"
          label="YouTube handle"
          defaultValue={cfg.channel}
          hint="Starts with @. Channel ID is auto-resolved on the first run and cached."
        />
        {cfg.channelId && (
          <p className="text-xs text-(--color-muted) -mt-2">
            Cached channel ID: <span className="font-mono text-(--color-cyan)">{cfg.channelId}</span>
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            name="author_id"
            label="Author user ID"
            defaultValue={cfg.authorId}
            hint="users.id of the admin to attribute the post to."
          />
          <Field
            name="category_slug"
            label="Category slug"
            defaultValue={cfg.categorySlug}
            hint="Must match an existing categories.slug."
          />
        </div>
        <div className="pt-2 flex items-center gap-3">
          <button className="btn-primary">Save</button>
        </div>
      </form>

      <form action={runNow} className="mb-8">
        <button className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-sm transition">
          Run now (manual trigger)
        </button>
      </form>

      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display font-semibold">Recent runs</h3>
        <p className="text-xs text-(--color-muted)">Last {runs.length} entries</p>
      </div>
      <div className="glass overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-(--color-muted) border-b border-white/10">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Trig.</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Video</th>
              <th className="px-4 py-3">Post</th>
              <th className="px-4 py-3">ms</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-(--color-muted)">
                  No runs yet — hit "Run now" to smoke test.
                </td>
              </tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                  {r.runAt instanceof Date ? r.runAt.toISOString().replace("T", " ").slice(0, 19) : String(r.runAt)}
                </td>
                <td className="px-4 py-3 text-xs uppercase">{r.trigger}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      r.status === "ok"
                        ? "text-(--color-green)"
                        : r.status === "skipped"
                        ? "text-(--color-amber)"
                        : "text-red-400"
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-xs truncate">
                  {r.videoUrl ? (
                    <a
                      href={r.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-(--color-cyan) hover:underline"
                    >
                      {r.videoTitle ?? r.videoId ?? "video"}
                    </a>
                  ) : (
                    <span className="text-(--color-muted)">—</span>
                  )}
                </td>
                <td className="px-4 py-3 max-w-xs truncate">
                  {r.postId && r.postSlug ? (
                    <a href={`/admin/posts/${r.postId}/edit`} className="text-(--color-cyan) hover:underline">
                      {r.postSlug}
                    </a>
                  ) : (
                    <span className="text-(--color-muted)">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.durationMs ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-(--color-muted) max-w-md truncate">
                  {r.errorMessage ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  hint,
  mono,
}: {
  name: string;
  label: string;
  defaultValue: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="kicker block mb-2">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        className={`w-full px-4 py-3 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition ${
          mono ? "font-mono text-sm" : ""
        }`}
      />
      {hint && <span className="block text-xs text-(--color-muted) mt-1">{hint}</span>}
    </label>
  );
}
