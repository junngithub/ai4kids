/** Shared read queries for parent + learner dashboards and the leaderboard. */
import { db } from "@/db";
import {
  users,
  parentChildren,
  activities,
  activityCompletions,
  learnerAchievements,
  achievements,
} from "@/db/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";

export type Kid = {
  id: number;
  name: string;
  username: string | null;
  ageGroup: string | null;
  avatar: string | null;
};

export async function getParentChildren(parentId: number): Promise<Kid[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      ageGroup: users.ageGroup,
      avatar: users.avatar,
    })
    .from(parentChildren)
    .innerJoin(users, eq(parentChildren.childId, users.id))
    .where(eq(parentChildren.parentId, parentId));
}

export type LearnerStats = {
  activitiesDone: number;
  totalScore: number;
  badges: number;
};

export async function getLearnerStats(learnerId: number): Promise<LearnerStats> {
  const [agg] = await db
    .select({
      activitiesDone: sql<number>`count(*)::int`,
      totalScore: sql<number>`coalesce(sum(${activityCompletions.score}),0)::int`,
    })
    .from(activityCompletions)
    .where(eq(activityCompletions.learnerId, learnerId));
  const [badgeRow] = await db
    .select({ badges: sql<number>`count(*)::int` })
    .from(learnerAchievements)
    .where(eq(learnerAchievements.learnerId, learnerId));
  return {
    activitiesDone: agg?.activitiesDone ?? 0,
    totalScore: agg?.totalScore ?? 0,
    badges: badgeRow?.badges ?? 0,
  };
}

export type RecentCompletion = {
  id: number;
  score: number;
  completedAt: Date;
  activityTitle: string;
  activityEmoji: string | null;
};

export async function getRecentCompletions(
  learnerId: number,
  limit = 10,
): Promise<RecentCompletion[]> {
  return db
    .select({
      id: activityCompletions.id,
      score: activityCompletions.score,
      completedAt: activityCompletions.completedAt,
      activityTitle: activities.title,
      activityEmoji: activities.emoji,
    })
    .from(activityCompletions)
    .innerJoin(activities, eq(activityCompletions.activityId, activities.id))
    .where(eq(activityCompletions.learnerId, learnerId))
    .orderBy(desc(activityCompletions.completedAt))
    .limit(limit);
}

export async function getLearnerBadges(learnerId: number) {
  return db
    .select({
      title: achievements.title,
      emoji: achievements.emoji,
      description: achievements.description,
      awardedAt: learnerAchievements.awardedAt,
    })
    .from(learnerAchievements)
    .innerJoin(achievements, eq(learnerAchievements.achievementId, achievements.id))
    .where(eq(learnerAchievements.learnerId, learnerId));
}

/** Leaderboard for one activity (only if leaderboard is enabled). Top N by score. */
export async function getActivityLeaderboard(activityId: number, limit = 20) {
  return db
    .select({
      learnerId: activityCompletions.learnerId,
      name: users.name,
      avatar: users.avatar,
      best: sql<number>`max(${activityCompletions.score})::int`,
      plays: sql<number>`count(*)::int`,
    })
    .from(activityCompletions)
    .innerJoin(users, eq(activityCompletions.learnerId, users.id))
    .where(eq(activityCompletions.activityId, activityId))
    .groupBy(activityCompletions.learnerId, users.name, users.avatar)
    .orderBy(desc(sql`max(${activityCompletions.score})`))
    .limit(limit);
}

/** Global leaderboard across all leaderboard-enabled activities. */
export async function getGlobalLeaderboard(limit = 20) {
  const enabled = await db
    .select({ id: activities.id })
    .from(activities)
    .where(eq(activities.leaderboardEnabled, true));
  const ids = enabled.map((a) => a.id);
  if (ids.length === 0) return [];
  return db
    .select({
      learnerId: activityCompletions.learnerId,
      name: users.name,
      avatar: users.avatar,
      total: sql<number>`coalesce(sum(${activityCompletions.score}),0)::int`,
    })
    .from(activityCompletions)
    .innerJoin(users, eq(activityCompletions.learnerId, users.id))
    .where(inArray(activityCompletions.activityId, ids))
    .groupBy(activityCompletions.learnerId, users.name, users.avatar)
    .orderBy(desc(sql`coalesce(sum(${activityCompletions.score}),0)`))
    .limit(limit);
}
