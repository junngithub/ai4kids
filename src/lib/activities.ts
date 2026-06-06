/** Activity catalog access + completion recording with simple badge awards. */
import { db } from "@/db";
import {
  activities,
  activityCompletions,
  achievements,
  learnerAchievements,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function getActivityBySlug(slug: string) {
  const [a] = await db.select().from(activities).where(eq(activities.slug, slug)).limit(1);
  return a ?? null;
}

export async function listActivities() {
  return db.select().from(activities).orderBy(activities.sortOrder);
}

/** Award a badge by slug if the learner doesn't have it yet (best-effort). */
async function awardBadge(learnerId: number, badgeSlug: string) {
  const [badge] = await db
    .select()
    .from(achievements)
    .where(eq(achievements.slug, badgeSlug))
    .limit(1);
  if (!badge) return;
  await db
    .insert(learnerAchievements)
    .values({ learnerId, achievementId: badge.id })
    .onConflictDoNothing();
}

/**
 * Record a learner's activity completion + score, then award milestone badges.
 * Returns the new total score for the activity-category.
 */
export async function recordCompletion(opts: {
  learnerId: number;
  activitySlug: string;
  score: number;
  metadata?: unknown;
}): Promise<{ ok: boolean; totalScore: number }> {
  const activity = await getActivityBySlug(opts.activitySlug);
  if (!activity) return { ok: false, totalScore: 0 };

  await db.insert(activityCompletions).values({
    learnerId: opts.learnerId,
    activityId: activity.id,
    score: Math.max(0, Math.round(opts.score)),
    metadata: (opts.metadata ?? null) as object | null,
  });

  // Badge logic.
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
    })
    .from(activityCompletions)
    .where(eq(activityCompletions.learnerId, opts.learnerId));
  if ((counts?.total ?? 0) >= 1) await awardBadge(opts.learnerId, "first-steps");
  if (opts.activitySlug.includes("story")) await awardBadge(opts.learnerId, "storyteller");
  if (opts.activitySlug.includes("phonics")) await awardBadge(opts.learnerId, "word-wizard");

  const [agg] = await db
    .select({ total: sql<number>`coalesce(sum(${activityCompletions.score}),0)::int` })
    .from(activityCompletions)
    .where(
      and(
        eq(activityCompletions.learnerId, opts.learnerId),
        eq(activityCompletions.activityId, activity.id),
      ),
    );
  return { ok: true, totalScore: agg?.total ?? 0 };
}
