/**
 * "Odd One Out" — a solo spot-the-difference game. Six cards share the same
 * animals in the same order; one card has a single animal swapped for another
 * (the count is preserved, so only the *which* differs). The player taps the odd
 * card before the timer runs out. Difficulty climbs each round (more animal types
 * and more emoji per card, so the swap is subtler).
 *
 * Each round has three timed sub-rounds (fresh cards each, the timer shrinking
 * from 6s toward a 1.5s floor). One wrong tap is forgiven — a second, or the
 * timer running out, ends the game as a LOSS. The COUNTDOWN lives on the client
 * (the board owns it and POSTs a `timeout` move at zero).
 */
import { GameEngine, GameMode, PlayerRef } from "./engine";

type OddCard = { id: number; counts: Record<string, number> };

export type OddOneState = {
  kind: "oddone";
  pid: number;
  pool: string[];
  roundsTotal: number;
  subroundsTotal: number;
  round: number;
  subround: number;
  cards: OddCard[];
  oddId: number;
  wrongPicks: number[];
  nextId: number;
  done: boolean;
  lost: boolean;
};

type OddOneMove = { type: "pick"; cardId: number } | { type: "timeout" };

const POOL = ["🐶", "🐱", "🐰", "🦊", "🐻"];
const ROUNDS_TOTAL = 5;
const SUBROUNDS_TOTAL = 3;
const BASE_MS = 6_000;
const SUB_STEP_MS = 1_500;
const FLOOR_MS = 1_500;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function roundMs(s: OddOneState): number {
  return Math.max(FLOOR_MS, BASE_MS - (s.subround - 1) * SUB_STEP_MS);
}

/**
 * Build four+ identical cards plus one "odd" card. The odd card swaps one emoji
 * for a different animal (keeping the total count), so it stands out only on a
 * close look. Difficulty climbs with the round.
 */
function deal(s: OddOneState): void {
  s.wrongPicks = [];
  const variety = clamp(s.round + 1, 2, s.pool.length); // animal types in play
  const total = clamp(s.round + 2, 3, 8); // emoji per card
  const types = s.pool.slice(0, variety);

  const base: Record<string, number> = {};
  for (const t of types) base[t] = 0;
  for (let i = 0; i < total; i++) {
    const t = pick(types);
    base[t] += 1;
  }

  const odd: Record<string, number> = { ...base };
  const from = pick(types.filter((t) => (odd[t] ?? 0) > 0));
  const to = pick(types.filter((t) => t !== from));
  odd[from] -= 1;
  odd[to] = (odd[to] ?? 0) + 1;

  const oddIdx = randInt(0, 6);
  s.cards = Array.from({ length: 6 }, (_, i) => ({
    id: s.nextId++,
    counts: { ...(i === oddIdx ? odd : base) },
  }));
  s.oddId = s.cards[oddIdx].id;
}

function advance(s: OddOneState): void {
  if (s.subround < s.subroundsTotal) {
    s.subround += 1;
    deal(s);
    return;
  }
  if (s.round >= s.roundsTotal) {
    s.done = true;
    return;
  }
  s.round += 1;
  s.subround = 1;
  deal(s);
}

export const oddone: GameEngine<OddOneState> = {
  init(players: PlayerRef[], _mode: GameMode): OddOneState {
    const s: OddOneState = {
      kind: "oddone",
      pid: players[0].id,
      pool: [...POOL],
      roundsTotal: ROUNDS_TOTAL,
      subroundsTotal: SUBROUNDS_TOTAL,
      round: 1,
      subround: 1,
      cards: [],
      oddId: -1,
      wrongPicks: [],
      nextId: 0,
      done: false,
      lost: false,
    };
    deal(s);
    return s;
  },

  move(state, _playerId, raw): OddOneState {
    if (state.done || state.lost) throw new Error("The game is over.");
    const m = raw as OddOneMove;
    if (m.type === "timeout") return { ...state, lost: true };
    if (m.type === "pick") {
      if (!state.cards.some((c) => c.id === m.cardId)) throw new Error("No such card.");
      if (state.wrongPicks.includes(m.cardId)) throw new Error("Already tried that one.");
      const s = structuredClone(state);
      if (m.cardId === s.oddId) {
        advance(s);
      } else {
        s.wrongPicks.push(m.cardId);
        if (s.wrongPicks.length >= 2) s.lost = true; // only one slip per sub-round
      }
      return s;
    }
    throw new Error("Unknown move.");
  },

  isOver(state): boolean {
    return state.done || state.lost;
  },

  winners(state): number[] {
    return state.done && !state.lost ? [state.pid] : [];
  },

  view(state, viewerId): unknown {
    return {
      kind: "oddone",
      animals: state.pool,
      cards: state.cards.map((c) => ({ id: c.id, counts: c.counts })),
      round: state.round,
      roundsTotal: state.roundsTotal,
      subround: state.subround,
      subroundsTotal: state.subroundsTotal,
      roundMs: roundMs(state),
      wrongPicks: state.wrongPicks,
      turnPlayerId: state.pid,
      yourTurn: viewerId === state.pid,
      finished: state.done ? [state.pid] : [],
    };
  },

  scoreFor(state, _playerId): number {
    if (!this.isOver(state)) return 0;
    if (state.lost) return Math.round(((state.round - 1) / state.roundsTotal) * 70);
    return 100;
  },

  currentPlayer(state): number {
    return state.pid;
  },

  skipTurn(state): OddOneState {
    return state;
  },
};