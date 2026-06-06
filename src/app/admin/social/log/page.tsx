/**
 * Chronological activity log for social-post dispatches.
 *
 * Distinct from /admin/social — that's the per-draft editor. This is a
 * read-only audit trail showing every published / failed attempt across all
 * blog posts, newest first. Click-through to the live LinkedIn / Facebook
 * post for verification.
 */
import { db } from "@/db";
import { socialPosts, posts } from "@/db/schema";
import { desc, eq, isNotNull, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PLATFORM_BADGE: Record<string, { bg: string; label: string }> = {
  linkedin: { bg: "bg-[#0a66c2]", label: "LinkedIn" },
  facebook: { bg: "bg-[#1877f2]", label: "Facebook" },
};

const STATUS_STYLE: Record<string, string> = {
  published: "bg-(--color-green)/15 text-(--color-green) border-(--color-green)/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  publishing: "bg-(--color-amber)/15 text-(--color-amber) border-(--color-amber)/30",
  scheduled: "bg-(--color-cyan)/15 text-(--color-cyan) border-(--color-cyan)/30",
  draft: "bg-white/5 text-white/60 border-white/15",
  cancelled: "bg-white/5 text-white/40 border-white/10",
};

export default async function SocialLogPage() {
  // Only rows that actually attempted publication — i.e., have a
  // lastAttemptAt, an externalUrl, or an errorMessage. Drafts in queue but
  // never dispatched aren't "log-worthy" yet.
  const rows = await db
    .select({
      id: socialPosts.id,
      platform: socialPosts.platform,
      status: socialPosts.status,
      attemptCount: socialPosts.attemptCount,
      lastAttemptAt: socialPosts.lastAttemptAt,
      publishedAt: socialPosts.publishedAt,
      externalId: socialPosts.externalId,
      externalUrl: socialPosts.externalUrl,
      errorMessage: socialPosts.errorMessage,
      contentPreview: socialPosts.content,
      postSlug: posts.slug,
      postTitle: posts.title,
    })
    .from(socialPosts)
    .leftJoin(posts, eq(posts.id, socialPosts.postId))
    .where(
      or(
        isNotNull(socialPosts.lastAttemptAt),
        isNotNull(socialPosts.externalUrl),
        isNotNull(socialPosts.errorMessage),
      ),
    )
    .orderBy(desc(socialPosts.lastAttemptAt), desc(socialPosts.publishedAt))
    .limit(200);

  const published = rows.filter((r) => r.status === "published").length;
  const failed = rows.filter((r) => r.status === "failed").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Social activity log</h1>
        <div className="flex items-center gap-4 text-sm">
          <a
            href="/admin/social"
            className="text-(--color-cyan) hover:underline"
          >
            ← Back to drafts queue
          </a>
          <span className="text-white/50 font-mono">
            [ {published} published · {failed} failed · {rows.length} total ]
          </span>
        </div>
      </div>
      <p className="text-sm text-(--color-muted) mb-6">
        Chronological audit trail of every LinkedIn + Facebook publish attempt.
        Click the platform pill or "View on …" to open the live post in a new
        tab. Use this view to verify auto-posts went live, copy a URL into a
        reply, or check what error the platform returned on a failure.
      </p>

      {rows.length === 0 ? (
        <div className="glass p-8 text-center text-white/60">
          No social-post activity yet. Publish a blog post (or click Publish
          Now on a draft) and entries will appear here with a clickable link
          to the live post.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const brand = PLATFORM_BADGE[r.platform] ?? {
              bg: "bg-white/10",
              label: r.platform,
            };
            const statusClass = STATUS_STYLE[r.status] ?? STATUS_STYLE.draft;
            const when = r.publishedAt ?? r.lastAttemptAt;
            return (
              <div
                key={r.id}
                className="glass p-4 flex flex-wrap items-center gap-3"
              >
                <span
                  className={`px-2 py-0.5 rounded text-white text-xs font-semibold ${brand.bg}`}
                >
                  {brand.label}
                </span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${statusClass}`}
                >
                  {r.status.toUpperCase()}
                </span>
                <span className="font-mono text-xs text-white/40">
                  {when ? new Date(when).toLocaleString() : "—"}
                </span>
                <div className="flex-1 min-w-[200px]">
                  {r.postSlug ? (
                    <a
                      href={`/blog/${r.postSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white hover:text-(--color-cyan) hover:underline truncate inline-block max-w-full align-middle"
                      title={r.postTitle ?? r.postSlug}
                    >
                      {r.postTitle ?? r.postSlug}
                    </a>
                  ) : (
                    <span className="text-sm text-white/50 italic">
                      (post deleted)
                    </span>
                  )}
                </div>
                {r.attemptCount > 0 && (
                  <span
                    className="font-mono text-[10px] text-white/40"
                    title={`Attempted ${r.attemptCount} time${r.attemptCount === 1 ? "" : "s"}`}
                  >
                    ×{r.attemptCount}
                  </span>
                )}
                {r.externalUrl ? (
                  <a
                    href={r.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-3 py-1.5 rounded-md ${brand.bg} text-white text-xs font-semibold whitespace-nowrap hover:brightness-110`}
                    title={`Open the live post on ${brand.label}`}
                  >
                    View on {brand.label} ↗
                  </a>
                ) : (
                  <span className="px-3 py-1.5 rounded-md bg-white/5 text-white/30 text-xs font-mono whitespace-nowrap">
                    no live URL
                  </span>
                )}
                {r.errorMessage && (
                  <div className="basis-full text-xs font-mono text-red-400 bg-red-500/5 border border-red-500/20 rounded p-2 break-all">
                    {r.errorMessage}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
