/**
 * Shared engine contract for the kids card games (memory, discard, math).
 *
 * Every game is a pure, server-authoritative state machine: the full state
 * (including hidden info like each player's hand) lives in one JSON-serialisable
 * object stored on the session row. The session layer never inspects game
 * internals — it only calls through this interface, so all three games plug into
 * the same lobby / polling / scoring plumbing.
 *
 * Conventions:
 *  - `move()` returns the next state, or throws `Error(message)` for an illegal
 *    move (the message is shown to the player).
 *  - `view()` redacts hidden info for one viewer (e.g. opponents' hand faces).
 *  - Player turn order is `order: number[]` (learner ids); `turn` indexes it.
 */

export type GameMode = "solo" | "coop" | "versus";

export type PlayerRef = { id: number; name: string };

/** A single card. `id` is stable identity (needed for memory + React keys). */
export type Card = { id: number; v: number };

/** Optional per-game setup knobs chosen by the host (e.g. Memory pair count). */
export type GameOptions = { pairs?: number };

export interface GameEngine<S> {
  /** Build the initial, fully-dealt state for these players + mode. */
  init(players: PlayerRef[], mode: GameMode, opts?: GameOptions): S;
  /** Apply a player's move. Throw `Error(msg)` to reject it. */
  move(state: S, playerId: number, move: unknown): S;
  /** Has the game ended? */
  isOver(state: S): boolean;
  /** Finished players, best-first (1st place at index 0). [] while in play. */
  winners(state: S): number[];
  /** Redact + shape the state for one viewer. */
  view(state: S, viewerId: number): unknown;
  /** 0–100 completion score for a player once the game is over. */
  scoreFor(state: S, playerId: number): number;
  /** The learner whose turn it currently is. */
  currentPlayer(state: S): number;
  /** Skip an absent player's turn (used when someone leaves mid-game). */
  skipTurn(state: S, playerId: number): S;
}

/* ------------------------------------------------------------------ */
/* Deck + RNG helpers                                                   */
/* ------------------------------------------------------------------ */

/** 40-card deck: values 1–10, four of each, with stable ids 0..39. */
export function makeDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (let copy = 0; copy < 4; copy++) {
    for (let v = 1; v <= 10; v++) cards.push({ id: id++, v });
  }
  return cards;
}

/** Fisher–Yates, returns a new array (does not mutate input). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deal `each` cards to `n` hands from the front of a deck; returns hands + rest. */
export function deal(deck: Card[], n: number, each: number): { hands: Card[][]; rest: Card[] } {
  const hands: Card[][] = Array.from({ length: n }, () => []);
  let k = 0;
  for (let r = 0; r < each; r++) {
    for (let p = 0; p < n; p++) hands[p].push(deck[k++]);
  }
  return { hands, rest: deck.slice(k) };
}

/** Map a 1st/2nd/3rd… placement to a friendly completion score. */
export function placeScore(place: number, totalPlayers: number): number {
  if (totalPlayers <= 1) return 100; // solo: finishing is the win
  const table = [100, 70, 55, 45];
  return table[Math.min(place, table.length - 1)] ?? 40;
}

/** Common turn helper: advance to the next player who hasn't finished. */
export function nextTurn(order: number[], turn: number, finished: number[]): number {
  const n = order.length;
  for (let step = 1; step <= n; step++) {
    const idx = (turn + step) % n;
    if (!finished.includes(order[idx])) return idx;
  }
  return turn; // everyone finished — leave as-is
}
