/**
 * Server helpers for card-game sessions (memory / discard / math), solo and
 * multiplayer. Mirrors escape-session.ts: a short code, poll-based sync, players
 * tracked for presence + scoring. The difference is the authoritative game state
 * lives in `card_sessions.state` (jsonb) and every game rule runs through the
 * engine registry — this layer treats state as opaque.
 */
import { db } from "@/db";
import { cardSessions, cardSessionPlayers, users, activities, activityCompletions } from "@/db/schema";
import { and, eq, gt, lt, notExists, or, sql } from "drizzle-orm";
import { getEngine } from "./card-games/registry";
import { getCardGame, type CardGameMode } from "./card-games/meta";
import { generateCode } from "./escape-session";
import { recordCompletion } from "./activities";
import type { PlayerRef, GameOptions } from "./card-games/engine";

export { generateCode };

/** Players whose last heartbeat is older than this are treated as "left". */
export const ACTIVE_MS = 30_000;
/** A turn-holder absent this long gets their turn auto-skipped (multiplayer). */
export const ABSENT_SKIP_MS = 20_000;
/** Keep a finished game's row this long so teammates' polls can show the result. */
export const DONE_GRACE_MS = 10 * 60_000;
/** A session with no player seen within this window is treated as abandoned. */
export const ABANDONED_MS = 60 * 60_000;

export type CardSessionRow = typeof cardSessions.$inferSelect;

export type CardPlayerDTO = {
  learnerId: number;
  name: string;
  avatar: string | null;
  isHost: boolean;
  place: number | null; // finishing place once the game is done (0 = winner)
};

export type CardStateDTO = {
  code: string;
  gameSlug: string;
  gameTitle: string;
  mode: CardGameMode;
  status: string; // lobby | playing | done
  hostId: number;
  you: number;
  players: CardPlayerDTO[];
  winners: number[];
  /** Engine-shaped, viewer-redacted game view. Null in the lobby. */
  game: unknown | null;
  /** Authoritative play clock (solo time-attack). ISO strings. */
  startedAt: string | null;
  finishedAt: string | null; // set once the game is done
  /** Viewer's best solo time (ms) for this game, incl. the current run if done. */
  bestMs: number | null;
};

/** The viewer's fastest solo time (ms) for a game, from completion metadata. */
async function soloBestMs(learnerId: number, activitySlug: string): Promise<number | null> {
  const [row] = await db
    .select({ best: sql<number | null>`min((${activityCompletions.metadata} ->> 'timeMs')::int)` })
    .from(activityCompletions)
    .innerJoin(activities, eq(activities.id, activityCompletions.activityId))
    .where(and(eq(activities.slug, activitySlug), eq(activityCompletions.learnerId, learnerId)));
  return row?.best ?? null;
}

export async function getCardSessionByCode(code: string): Promise<CardSessionRow | null> {
  const [s] = await db
    .select()
    .from(cardSessions)
    .where(eq(cardSessions.code, code.trim().toUpperCase()))
    .limit(1);
  return s ?? null;
}

/** Free up codes from finished/abandoned sessions. Best-effort, never throws. */
export async function cleanupStaleCardSessions(): Promise<void> {
  const doneCutoff = new Date(Date.now() - DONE_GRACE_MS);
  const abandonedCutoff = new Date(Date.now() - ABANDONED_MS);
  try {
    await db.delete(cardSessions).where(
      or(
        and(eq(cardSessions.status, "done"), lt(cardSessions.updatedAt, doneCutoff)),
        notExists(
          db
            .select({ one: sql`1` })
            .from(cardSessionPlayers)
            .where(
              and(
                eq(cardSessionPlayers.sessionId, cardSessions.id),
                gt(cardSessionPlayers.lastSeen, abandonedCutoff),
              ),
            ),
        ),
      ),
    );
  } catch {
    /* best-effort */
  }
}

/** Add or refresh a learner as a player. select-then-insert/update (no upsert). */
export async function upsertCardPlayer(opts: {
  sessionId: number;
  learnerId: number;
  name: string;
}): Promise<void> {
  const [existing] = await db
    .select({ id: cardSessionPlayers.id })
    .from(cardSessionPlayers)
    .where(
      and(
        eq(cardSessionPlayers.sessionId, opts.sessionId),
        eq(cardSessionPlayers.learnerId, opts.learnerId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(cardSessionPlayers)
      .set({ lastSeen: new Date() })
      .where(eq(cardSessionPlayers.id, existing.id));
    return;
  }

  const [u] = await db
    .select({ avatar: users.avatar })
    .from(users)
    .where(eq(users.id, opts.learnerId))
    .limit(1);
  await db.insert(cardSessionPlayers).values({
    sessionId: opts.sessionId,
    learnerId: opts.learnerId,
    name: opts.name,
    avatar: u?.avatar ?? null,
    lastSeen: new Date(),
  });
}

/** Present players (heartbeat within the active window), join order. */
export async function activePlayers(sessionId: number): Promise<
  { learnerId: number; name: string; avatar: string | null }[]
> {
  const cutoff = new Date(Date.now() - ACTIVE_MS);
  const rows = await db
    .select()
    .from(cardSessionPlayers)
    .where(
      and(
        eq(cardSessionPlayers.sessionId, sessionId),
        gt(cardSessionPlayers.lastSeen, cutoff),
      ),
    )
    .orderBy(cardSessionPlayers.joinedAt);
  return rows.map((r) => ({ learnerId: r.learnerId, name: r.name, avatar: r.avatar }));
}

/** True when this learner currently belongs to the session. */
export async function isCardPlayer(sessionId: number, learnerId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: cardSessionPlayers.id })
    .from(cardSessionPlayers)
    .where(
      and(
        eq(cardSessionPlayers.sessionId, sessionId),
        eq(cardSessionPlayers.learnerId, learnerId),
      ),
    )
    .limit(1);
  return !!row;
}

/** Player refs for engine init — the roster at game start, in join order. */
export async function playerRefs(sessionId: number): Promise<PlayerRef[]> {
  const rows = await activePlayers(sessionId);
  return rows.map((r) => ({ id: r.learnerId, name: r.name }));
}

/**
 * Deal a fresh game for the session's current players and flip it to `playing`.
 * Returns the updated row, or throws `Error(msg)` if the player count is wrong.
 */
export async function startGame(
  session: CardSessionRow,
  opts?: GameOptions,
): Promise<CardSessionRow> {
  const engine = getEngine(session.gameSlug);
  const meta = getCardGame(session.gameSlug);
  if (!engine || !meta) throw new Error("Unknown game.");
  const refs = await playerRefs(session.id);
  if (session.mode === "solo") {
    if (refs.length !== 1) throw new Error("Solo games are for one player.");
  } else {
    if (refs.length < meta.minPlayers) throw new Error(`Need at least ${meta.minPlayers} players.`);
    if (refs.length > meta.maxPlayers) throw new Error(`Up to ${meta.maxPlayers} players only.`);
  }
  const state = engine.init(refs, session.mode as CardGameMode, opts);
  const [row] = await db
    .update(cardSessions)
    .set({ state, status: "playing", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(cardSessions.id, session.id))
    .returning();
  return row;
}

/**
 * If the player whose turn it is has gone quiet (left mid-game), skip their
 * turn so the table isn't stuck waiting on them. Solo games never skip (the
 * lone player is the one polling). Row-locked + re-checked so concurrent polls
 * can't double-skip. Returns the (possibly updated) session row.
 */
export async function maybeSkipAbsent(session: CardSessionRow): Promise<CardSessionRow> {
  if (session.status !== "playing" || !session.state || session.mode === "solo") return session;
  const engine = getEngine(session.gameSlug);
  if (!engine) return session;
  const cur = engine.currentPlayer(session.state);

  const cutoff = new Date(Date.now() - ABSENT_SKIP_MS);
  const [row] = await db
    .select({ lastSeen: cardSessionPlayers.lastSeen })
    .from(cardSessionPlayers)
    .where(and(eq(cardSessionPlayers.sessionId, session.id), eq(cardSessionPlayers.learnerId, cur)))
    .limit(1);
  if (row && row.lastSeen > cutoff) return session; // still present — nothing to do

  let updated = session;
  await db.transaction(async (tx) => {
    const [s] = await tx
      .select()
      .from(cardSessions)
      .where(eq(cardSessions.id, session.id))
      .for("update");
    // Re-check under the lock: a real move or another skip may have landed.
    if (!s || s.status !== "playing" || !s.state) return;
    if (engine.currentPlayer(s.state) !== cur) return;
    const next = engine.skipTurn(s.state, cur);
    const [u] = await tx
      .update(cardSessions)
      .set({ state: next, updatedAt: new Date() })
      .where(eq(cardSessions.id, session.id))
      .returning();
    if (u) updated = u;
  });
  return updated;
}

/**
 * Drive a real-time game's clock: resolve an expired answer window / advance to
 * the next round (engines that expose `tick`). Row-locked + re-ticked under the
 * lock so concurrent polls can't double-advance. Sets winners + records
 * completions if the tick ends the game. No-op for turn-based games (no `tick`).
 */
export async function maybeTick(session: CardSessionRow): Promise<CardSessionRow> {
  if (session.status !== "playing" || !session.state) return session;
  const engine = getEngine(session.gameSlug);
  if (!engine?.tick) return session;
  // Cheap pre-check outside the lock — skip the transaction if nothing's due.
  if (!engine.tick(session.state, Date.now())) return session;

  let updated = session;
  let becameDone = false;
  await db.transaction(async (tx) => {
    const [s] = await tx
      .select()
      .from(cardSessions)
      .where(eq(cardSessions.id, session.id))
      .for("update");
    if (!s || s.status !== "playing" || !s.state) return;
    const next = engine.tick!(s.state, Date.now());
    if (!next) return; // another poll already advanced it
    const over = engine.isOver(next);
    const winners = over ? engine.winners(next) : [];
    const [u] = await tx
      .update(cardSessions)
      .set({ state: next, winners, status: over ? "done" : "playing", updatedAt: new Date() })
      .where(eq(cardSessions.id, session.id))
      .returning();
    if (u) {
      updated = u;
      becameDone = over;
    }
  });
  if (becameDone) await recordCardCompletions(updated);
  return updated;
}

/** Record a completion for every roster player once the game is done. */
export async function recordCardCompletions(session: CardSessionRow): Promise<void> {
  const engine = getEngine(session.gameSlug);
  const meta = getCardGame(session.gameSlug);
  if (!engine || !meta || !session.state) return;
  const rows = await db
    .select({ learnerId: cardSessionPlayers.learnerId })
    .from(cardSessionPlayers)
    .where(eq(cardSessionPlayers.sessionId, session.id));
  // Solo time-attack: store the elapsed ms so we can track personal bests — but
  // only for a WIN. A timed-out loss (winners is empty) must not poison the best.
  const winners = (session.winners as number[]) ?? [];
  const elapsedMs =
    session.mode === "solo" && session.startedAt
      ? Math.max(0, session.updatedAt.getTime() - session.startedAt.getTime())
      : undefined;
  await Promise.all(
    rows.map((p) => {
      const timeMs = elapsedMs != null && winners.includes(p.learnerId) ? elapsedMs : undefined;
      return recordCompletion({
        learnerId: p.learnerId,
        activitySlug: meta.activitySlug,
        score: engine.scoreFor(session.state, p.learnerId),
        metadata: {
          game: session.gameSlug,
          mode: session.mode,
          code: session.code,
          coop: session.mode !== "solo",
          ...(timeMs != null ? { timeMs } : {}),
        },
      }).catch(() => {});
    }),
  );
}

/** Serialise the full shared state for polling clients (viewer-redacted). */
export async function buildCardState(
  session: CardSessionRow,
  viewerId = 0,
): Promise<CardStateDTO> {
  const present = await activePlayers(session.id);
  const winners = (session.winners as number[]) ?? [];
  const engine = getEngine(session.gameSlug);
  const game =
    session.state && engine ? engine.view(session.state, viewerId) : null;

  // Solo time-attack: surface the play clock + the viewer's personal best.
  const meta = getCardGame(session.gameSlug);
  const isSolo = session.mode === "solo";
  const bestMs = isSolo && meta ? await soloBestMs(viewerId, meta.activitySlug) : null;

  return {
    code: session.code,
    gameSlug: session.gameSlug,
    gameTitle: meta?.title ?? session.gameSlug,
    mode: session.mode as CardGameMode,
    status: session.status,
    hostId: session.hostId,
    you: viewerId,
    players: present.map((p) => ({
      learnerId: p.learnerId,
      name: p.name,
      avatar: p.avatar,
      isHost: p.learnerId === session.hostId,
      place: winners.length ? (winners.indexOf(p.learnerId) >= 0 ? winners.indexOf(p.learnerId) : null) : null,
    })),
    winners,
    game,
    startedAt: session.startedAt ? session.startedAt.toISOString() : null,
    finishedAt: session.status === "done" ? session.updatedAt.toISOString() : null,
    bestMs,
  };
}
