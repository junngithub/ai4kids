/**
 * Dispatcher — picks scheduled social_posts whose scheduledAt has passed,
 * marks them 'publishing', calls the right platform client, then marks
 * 'published' (with externalId + URL) or 'failed' (with errorMessage).
 *
 * Designed to be called from /api/cron/social-dispatch every few minutes by
 * Coolify's cron, and from the admin "Dispatch now" button for one-off runs.
 */

import { db } from "@/db";
import { socialPosts } from "@/db/schema";
import { and, eq, isNotNull, lte, or } from "drizzle-orm";
import { postToLinkedIn } from "@/lib/social/linkedin";
import { postToFacebook } from "@/lib/social/facebook";

const MAX_ATTEMPTS = 3;

export type DispatchResult = {
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

export async function dispatchDueSocialPosts(opts?: {
  ids?: number[];
}): Promise<DispatchResult> {
  const now = new Date();
  const due = opts?.ids && opts.ids.length > 0
    ? await db
        .select()
        .from(socialPosts)
        .where(
          and(
            or(
              eq(socialPosts.status, "scheduled"),
              eq(socialPosts.status, "failed"),
              eq(socialPosts.status, "draft"),
            ),
            // any of the requested ids — Drizzle inArray would be cleaner;
            // ids are tiny so simple OR chain via in-memory filter is fine.
          ),
        )
        .then((rows) => rows.filter((r) => opts.ids!.includes(r.id)))
    : await db
        .select()
        .from(socialPosts)
        .where(
          and(
            eq(socialPosts.status, "scheduled"),
            isNotNull(socialPosts.scheduledAt),
            lte(socialPosts.scheduledAt, now),
          ),
        );

  const result: DispatchResult = {
    picked: due.length,
    published: 0,
    failed: 0,
    details: [],
  };

  for (const row of due) {
    if (row.attemptCount >= MAX_ATTEMPTS && row.status === "failed") {
      // Hard-capped retries — skip until an editor resets.
      result.details.push({
        id: row.id,
        platform: row.platform,
        ok: false,
        error: `max attempts (${MAX_ATTEMPTS}) reached`,
      });
      continue;
    }

    await db
      .update(socialPosts)
      .set({
        status: "publishing",
        lastAttemptAt: new Date(),
        attemptCount: row.attemptCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(socialPosts.id, row.id));

    try {
      const r =
        row.platform === "linkedin"
          ? await postToLinkedIn({
              content: row.content,
              imageUrl: row.imageUrl,
              linkUrl: row.linkUrl,
            })
          : await postToFacebook({
              content: row.content,
              imageUrl: row.imageUrl,
              linkUrl: row.linkUrl,
            });

      await db
        .update(socialPosts)
        .set({
          status: "published",
          publishedAt: new Date(),
          externalId: r.externalId,
          externalUrl: r.externalUrl,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, row.id));

      result.published += 1;
      result.details.push({
        id: row.id,
        platform: row.platform,
        ok: true,
        externalUrl: r.externalUrl,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db
        .update(socialPosts)
        .set({
          status: "failed",
          errorMessage: msg.slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, row.id));

      result.failed += 1;
      result.details.push({
        id: row.id,
        platform: row.platform,
        ok: false,
        error: msg,
      });
    }
  }

  return result;
}
