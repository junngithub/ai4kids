"use client";

import { useState, useTransition } from "react";

export type SocialPostRow = {
  id: number;
  postId: number | null;
  postSlug: string | null;
  postTitle: string | null;
  platform: "linkedin" | "facebook";
  status: "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
  content: string;
  imageUrl: string | null;
  linkUrl: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: string;
};

type DispatchResult = {
  picked: number;
  published: number;
  failed: number;
  details: Array<{
    id: number;
    platform: string;
    ok: boolean;
    externalUrl?: string;
    error?: string;
  }>;
};

type Props = {
  rows: SocialPostRow[];
  deleteMany: (ids: number[]) => Promise<void>;
  updateRow: (input: {
    id: number;
    content?: string;
    scheduledAt?: string | null;
    status?: SocialPostRow["status"];
  }) => Promise<void>;
  dispatchNow: (ids: number[]) => Promise<DispatchResult>;
  regenerate: (id: number) => Promise<void>;
  regenerateAndRepost: (id: number) => Promise<DispatchResult>;
};

const STATUS_PILL: Record<SocialPostRow["status"], string> = {
  draft: "bg-white/5 text-white/70 border-white/15",
  scheduled: "bg-(--color-cyan)/15 text-(--color-cyan) border-(--color-cyan)/30",
  publishing: "bg-(--color-amber)/15 text-(--color-amber) border-(--color-amber)/30",
  published: "bg-(--color-green)/15 text-(--color-green) border-(--color-green)/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  cancelled: "bg-white/5 text-white/40 border-white/10",
};

const PLATFORM_LABEL: Record<SocialPostRow["platform"], string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
};

const PLATFORM_BRAND: Record<SocialPostRow["platform"], { bg: string; hover: string }> = {
  linkedin: { bg: "bg-[#0a66c2]", hover: "hover:bg-[#004182]" },
  facebook: { bg: "bg-[#1877f2]", hover: "hover:bg-[#0c5fc5]" },
};

/** Convert an ISO string to the format an <input type="datetime-local"> wants. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToISO(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

export function SocialPostsTable({
  rows,
  deleteMany,
  updateRow,
  dispatchNow,
  regenerate,
  regenerateAndRepost,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Record<number, { content: string; scheduledAt: string }>>(
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        { content: r.content, scheduledAt: isoToLocalInput(r.scheduledAt) },
      ]),
    ),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function saveRow(id: number) {
    const draft = editing[id];
    startTransition(async () => {
      await updateRow({
        id,
        content: draft.content,
        scheduledAt: localInputToISO(draft.scheduledAt),
      });
      setMsg(`Saved #${id}`);
    });
  }

  function schedule(id: number) {
    const draft = editing[id];
    if (!draft.scheduledAt) {
      setMsg("Pick a date/time first.");
      return;
    }
    startTransition(async () => {
      await updateRow({
        id,
        content: draft.content,
        scheduledAt: localInputToISO(draft.scheduledAt),
        status: "scheduled",
      });
      setMsg(`Scheduled #${id} for ${draft.scheduledAt}`);
    });
  }

  function cancel(id: number) {
    startTransition(async () => {
      await updateRow({ id, status: "cancelled" });
      setMsg(`Cancelled #${id}`);
    });
  }

  function regenerateOne(id: number) {
    if (!confirm("Regenerate the post copy from the blog using AI? This replaces what's in the textarea.")) return;
    startTransition(async () => {
      setMsg(`Regenerating #${id} via Claude…`);
      await regenerate(id);
      setMsg(`Regenerated #${id} — reload page to see new copy.`);
    });
  }

  function repostOne(id: number, platform: string) {
    const human = platform === "linkedin" ? "LinkedIn" : "Facebook";
    if (
      !confirm(
        `Re-roll the copy with AI and post a NEW ${human} update?\n\nNote: the previous post stays live on ${human} — delete it manually first if you want a clean replacement.`,
      )
    )
      return;
    startTransition(async () => {
      setMsg(`Regenerating + posting #${id} to ${human}…`);
      const r = await regenerateAndRepost(id);
      const d = r.details[0];
      if (d?.ok) setMsg(`Re-published: ${d.externalUrl}`);
      else setMsg(`Failed: ${d?.error ?? "unknown error"}`);
    });
  }

  function dispatchOne(id: number) {
    if (!confirm("Publish to the platform right now?")) return;
    startTransition(async () => {
      const r = await dispatchNow([id]);
      const d = r.details[0];
      if (d?.ok) setMsg(`Published: ${d.externalUrl}`);
      else setMsg(`Failed: ${d?.error ?? "unknown error"}`);
    });
  }

  function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} social post(s)?`)) return;
    startTransition(async () => {
      await deleteMany(Array.from(selected));
      setSelected(new Set());
      setMsg(`Deleted ${selected.size} row(s).`);
    });
  }

  if (rows.length === 0) {
    return (
      <div className="glass p-8 text-center text-white/60">
        No social posts yet. Publish a blog post and drafts will appear here automatically.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            disabled={selected.size === 0 || pending}
            onClick={deleteSelected}
            className="px-3 py-2 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
          >
            Delete selected ({selected.size})
          </button>
          {msg && (
            <span className="text-xs text-(--color-cyan) font-mono break-all">
              {msg.split(/(\bhttps?:\/\/\S+)/g).map((part, i) =>
                /^https?:\/\//.test(part) ? (
                  <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-(--color-green)"
                  >
                    {part}
                  </a>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((r) => {
          const e = editing[r.id];
          const pill = STATUS_PILL[r.status];
          const canEdit = r.status === "draft" || r.status === "scheduled" || r.status === "failed";
          return (
            <div key={r.id} className="glass p-5 space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="w-4 h-4"
                  />
                  <span className="font-mono text-xs text-white/50">#{r.id}</span>
                  <span className="font-semibold">{PLATFORM_LABEL[r.platform]}</span>
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${pill}`}>
                    {r.status.toUpperCase()}
                  </span>
                  {r.postSlug && (
                    <a
                      href={`/blog/${r.postSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-(--color-cyan) hover:underline"
                    >
                      {r.postTitle ?? r.postSlug} ↗
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {r.externalUrl && (
                    <a
                      href={r.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open the live post on ${PLATFORM_LABEL[r.platform]} in a new tab`}
                      className={`px-3 py-1.5 rounded-md ${PLATFORM_BRAND[r.platform].bg} ${PLATFORM_BRAND[r.platform].hover} text-white text-xs font-semibold whitespace-nowrap`}
                    >
                      View on {PLATFORM_LABEL[r.platform]} ↗
                    </a>
                  )}
                </div>
              </div>

              <textarea
                disabled={!canEdit || pending}
                value={e.content}
                onChange={(ev) =>
                  setEditing((m) => ({ ...m, [r.id]: { ...e, content: ev.target.value } }))
                }
                rows={6}
                className="w-full px-3 py-2 bg-white/3 border border-white/10 rounded-lg font-mono text-sm disabled:opacity-60"
              />

              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">
                      Schedule for
                    </label>
                    <input
                      type="datetime-local"
                      disabled={!canEdit || pending}
                      value={e.scheduledAt}
                      onChange={(ev) =>
                        setEditing((m) => ({
                          ...m,
                          [r.id]: { ...e, scheduledAt: ev.target.value },
                        }))
                      }
                      className="px-3 py-2 bg-white/3 border border-white/10 rounded-lg text-sm font-mono disabled:opacity-60"
                    />
                  </div>
                  {r.imageUrl && (
                    <a
                      href={r.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-(--color-cyan) hover:underline self-end pb-3"
                    >
                      cover image ↗
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    disabled={!canEdit || pending}
                    onClick={() => regenerateOne(r.id)}
                    className="px-3 py-2 text-sm rounded-lg border border-(--color-purple)/40 text-(--color-purple) hover:bg-(--color-purple)/10 disabled:opacity-40"
                    title="Re-run Claude on the blog content and replace the copy with a fresh version"
                  >
                    ✨ Regenerate
                  </button>
                  <button
                    disabled={!canEdit || pending}
                    onClick={() => saveRow(r.id)}
                    className="px-3 py-2 text-sm rounded-lg border border-white/15 hover:border-(--color-cyan)/50 hover:text-(--color-cyan) disabled:opacity-40"
                  >
                    Save draft
                  </button>
                  <button
                    disabled={!canEdit || pending}
                    onClick={() => schedule(r.id)}
                    className="px-3 py-2 text-sm rounded-lg border border-(--color-cyan)/40 text-(--color-cyan) hover:bg-(--color-cyan)/10 disabled:opacity-40"
                  >
                    Schedule
                  </button>
                  <button
                    disabled={!canEdit || pending}
                    onClick={() => dispatchOne(r.id)}
                    className="btn-primary text-sm disabled:opacity-40"
                  >
                    Publish now
                  </button>
                  {(r.status === "scheduled" || r.status === "failed") && (
                    <button
                      disabled={pending}
                      onClick={() => cancel(r.id)}
                      className="px-3 py-2 text-sm rounded-lg border border-white/15 text-white/60 hover:text-white disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  )}
                  {r.status === "published" && (
                    <button
                      disabled={pending}
                      onClick={() => repostOne(r.id, r.platform)}
                      className="px-3 py-2 text-sm rounded-lg border border-(--color-purple)/40 text-(--color-purple) hover:bg-(--color-purple)/10 disabled:opacity-40"
                      title="Regenerate the copy with AI and post a fresh update on the platform. Previous post stays live unless you delete it manually."
                    >
                      🔁 Re-roll &amp; repost
                    </button>
                  )}
                </div>
              </div>

              {r.errorMessage && (
                <div className="mt-2 text-xs font-mono text-red-400 bg-red-500/5 border border-red-500/20 rounded p-2 break-all">
                  Attempt {r.attemptCount}: {r.errorMessage}
                </div>
              )}
              {r.scheduledAt && r.status === "scheduled" && (
                <p className="text-xs text-white/50 font-mono">
                  scheduled · {new Date(r.scheduledAt).toLocaleString()}
                </p>
              )}
              {r.publishedAt && (
                <p className="text-xs text-(--color-green)/70 font-mono">
                  published · {new Date(r.publishedAt).toLocaleString()}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
