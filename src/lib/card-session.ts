/**
 * Server helpers for card-game sessions (memory / discard / math), solo and
 * multiplayer. Mirrors escape-session.ts: a short code, poll-based sync, players
 * tracked for presence + scoring. The difference is the authoritative game state
 * lives in `card_sessions.state` (jsonb) and every game rule runs through the
 * engine registry — this layer treats state as opaque.
 */
import { db } from "@/db";
import { cardSessions, cardSessionPlayers, users } from "@/db/schema";
import { and, eq, gt, lt, notExists, or, sql } from "drizzle-orm";
import { getEngine } from "./card-games/registry";
import { getCardGame, type CardGameMode } from "./card-games/meta";
import { generateCode } from "./escape-session";
import { recordCompletion } from "./activities";
import type { PlayerRef } from "./card-games/engine";

export { generateCode };

/** Players whose last heartbeat is older than this are treated as "left". */
export const ACTIVE_MS = 30_000;
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
};

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
export async function startGame(session: CardSessionRow): Promise<CardSessionRow> {
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
  const state = engine.init(refs, session.mode as CardGameMode);
  const [row] = await db
    .update(cardSessions)
    .set({ state, status: "playing", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(cardSessions.id, session.id))
    .returning();
  return row;
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
  await Promise.all(
    rows.map((p) =>
      recordCompletion({
        learnerId: p.learnerId,
        activitySlug: meta.activitySlug,
        score: engine.scoreFor(session.state, p.learnerId),
        metadata: { game: session.gameSlug, mode: session.mode, code: session.code, coop: session.mode !== "solo" },
      }).catch(() => {}),
    ),
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

  return {
    code: session.code,
    gameSlug: session.gameSlug,
    gameTitle: getCardGame(session.gameSlug)?.title ?? session.gameSlug,
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
  };
}
