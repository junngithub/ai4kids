/**
 * Server helpers for co-op (multiplayer) escape-room sessions.
 *
 * A session is a shared game several learners join with a short code. Progress
 * (solved station ids + team points) lives on the session row; players are
 * tracked for presence and final scoring. Sync is poll-based (no websockets),
 * which keeps it compatible with the Next standalone deployment.
 */
import { db } from "@/db";
import { escapeSessions, escapeSessionPlayers, users } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import { getEscapeRoom } from "./escape-rooms";

/** Players whose last heartbeat is older than this are treated as "left". */
export const ACTIVE_MS = 30_000;
export const POINTS_FIRST_TRY = 10;
export const POINTS_WITH_HELP = 6;

// Short, kid-friendly, unambiguous code words (no easily-confused letters).
const CODE_WORDS = [
  "LION", "STAR", "KITE", "MOON", "FROG", "BEAR", "DUCK", "MINT",
  "NOVA", "PUMA", "JADE", "RUBY", "WAVE", "PALM", "KOALA", "TIGER",
];

export function generateCode(): string {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${word}${num}`;
}

export type EscapeSessionRow = typeof escapeSessions.$inferSelect;

export type PlayerDTO = {
  learnerId: number;
  name: string;
  avatar: string | null;
  atStation: string | null;
  isHost: boolean;
};

export type SessionStateDTO = {
  code: string;
  roomSlug: string;
  status: string; // lobby | playing | escaped
  solved: string[];
  points: number;
  total: number;
  hostId: number;
  you: number; // the requesting learner's id
  players: PlayerDTO[];
};

export async function getSessionByCode(code: string): Promise<EscapeSessionRow | null> {
  const [s] = await db
    .select()
    .from(escapeSessions)
    .where(eq(escapeSessions.code, code.trim().toUpperCase()))
    .limit(1);
  return s ?? null;
}

/**
 * Add (or refresh) a learner as a player in the session. Implemented as
 * select-then-insert/update rather than ON CONFLICT so it doesn't depend on a
 * DB-level unique constraint (the migration still adds one for integrity).
 */
export async function upsertPlayer(opts: {
  sessionId: number;
  learnerId: number;
  name: string;
}): Promise<void> {
  const [existing] = await db
    .select({ id: escapeSessionPlayers.id })
    .from(escapeSessionPlayers)
    .where(
      and(
        eq(escapeSessionPlayers.sessionId, opts.sessionId),
        eq(escapeSessionPlayers.learnerId, opts.learnerId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(escapeSessionPlayers)
      .set({ lastSeen: new Date() })
      .where(eq(escapeSessionPlayers.id, existing.id));
    return;
  }

  const [u] = await db
    .select({ avatar: users.avatar })
    .from(users)
    .where(eq(users.id, opts.learnerId))
    .limit(1);
  await db.insert(escapeSessionPlayers).values({
    sessionId: opts.sessionId,
    learnerId: opts.learnerId,
    name: opts.name,
    avatar: u?.avatar ?? null,
    lastSeen: new Date(),
  });
}

/** Serialise the full shared state for polling clients. */
export async function buildState(
  session: EscapeSessionRow,
  viewerId = 0,
): Promise<SessionStateDTO> {
  const cutoff = new Date(Date.now() - ACTIVE_MS);
  const rows = await db
    .select()
    .from(escapeSessionPlayers)
    .where(
      and(
        eq(escapeSessionPlayers.sessionId, session.id),
        gt(escapeSessionPlayers.lastSeen, cutoff),
      ),
    )
    .orderBy(escapeSessionPlayers.joinedAt);

  const total = getEscapeRoom(session.roomSlug)?.stations.length ?? 0;
  return {
    code: session.code,
    roomSlug: session.roomSlug,
    status: session.status,
    solved: (session.solved as string[]) ?? [],
    points: session.points,
    total,
    hostId: session.hostId,
    you: viewerId,
    players: rows.map((p) => ({
      learnerId: p.learnerId,
      name: p.name,
      avatar: p.avatar,
      atStation: p.atStation,
      isHost: p.learnerId === session.hostId,
    })),
  };
}

/** True when this learner currently belongs to the session. */
export async function isPlayer(sessionId: number, learnerId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: escapeSessionPlayers.id })
    .from(escapeSessionPlayers)
    .where(
      and(
        eq(escapeSessionPlayers.sessionId, sessionId),
        eq(escapeSessionPlayers.learnerId, learnerId),
      ),
    )
    .limit(1);
  return !!row;
}

/** Touch a session's updatedAt (call after mutating progress/status). */
export function touchSql() {
  return sql`now()`;
}
