/**
 * "Animal Count" — a solo spot-the-count game. A `wheel` of animals spins to a
 * `targetAnimal`; a `targetCount` (0–2) is called. The player taps the one card
 * (of five) showing exactly that many of the target animal. Every card shows all
 * five animals (the full pool) so only the target's count distinguishes them.
 *
 * Each animal is played over three timed sub-rounds (fresh cards each, the timer
 * shrinking from 6s toward a 1.5s floor); clearing all three retires that animal
 * from the wheel and advances the round. One wrong tap is forgiven — a second, or
 * the timer running out, ends the game as a LOSS. The COUNTDOWN lives on the
 * client (the board owns it and POSTs a `timeout` move at zero).
 */
import { GameEngine, GameMode, PlayerRef } from "./engine";

type WheelCard = { id: number; counts: Record<string, number> };

export type WheelState = {
  kind: "wheel";
  pid: number;
  pool: string[];
  wheel: string[]; // animals that can still be the target
  roundsTotal: number;
  subroundsTotal: number;
  round: number;
  subround: number;
  targetAnimal: string;
  targetCount: number;
  cards: WheelCard[];
  wrongPicks: number[];
  nextId: number;
  done: boolean;
  lost: boolean;
};

type WheelMove = { type: "pick"; cardId: number } | { type: "timeout" };

const POOL = ["🐶", "🐱", "🐰", "🦊", "🐻"];
const ROUNDS_TOTAL = 5;
const SUBROUNDS_TOTAL = 3;
const BASE_MS = 6_000;
const SUB_STEP_MS = 1_500;
const FLOOR_MS = 1_500;

const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function roundMs(s: WheelState): number {
  return Math.max(FLOOR_MS, BASE_MS - (s.subround - 1) * SUB_STEP_MS);
}

/** Pick the round's target animal (the lone one on the last round) + number. */
function spin(s: WheelState): void {
  s.targetAnimal = pick(s.wheel);
  s.targetCount = randInt(0, 3); // 0..2
}

/** Fresh hand of 5; exactly one card carries the target count (unique answer). */
function deal(s: WheelState): void {
  s.wrongPicks = [];
  const answer = randInt(0, 5);
  s.cards = Array.from({ length: 5 }, (_, i) => {
    const counts: Record<string, number> = {};
    for (const a of s.pool) {
      counts[a] =
        a !== s.targetAnimal
          ? randInt(0, 3)
          : i === answer
            ? s.targetCount
            : pick([0, 1, 2].filter((n) => n !== s.targetCount));
    }
    return { id: s.nextId++, counts };
  });
}

function advance(s: WheelState): void {
  if (s.subround < s.subroundsTotal) {
    s.subround += 1;
    deal(s); // same animal/number, fresh cards, tighter timer
    return;
  }
  if (s.round >= s.roundsTotal) {
    s.done = true;
    return;
  }
  s.wheel = s.wheel.filter((a) => a !== s.targetAnimal); // retire the cleared animal
  s.round += 1;
  s.subround = 1;
  spin(s);
  deal(s);
}

export const wheel: GameEngine<WheelState> = {
  init(players: PlayerRef[], _mode: GameMode): WheelState {
    const s: WheelState = {
      kind: "wheel",
      pid: players[0].id,
      pool: [...POOL],
      wheel: [...POOL],
      roundsTotal: ROUNDS_TOTAL,
      subroundsTotal: SUBROUNDS_TOTAL,
      round: 1,
      subround: 1,
      targetAnimal: "",
      targetCount: 0,
      cards: [],
      wrongPicks: [],
      nextId: 0,
      done: false,
      lost: false,
    };
    spin(s);
    deal(s);
    return s;
  },

  move(state, _playerId, raw): WheelState {
    if (state.done || state.lost) throw new Error("The game is over.");
    const m = raw as WheelMove;
    if (m.type === "timeout") return { ...state, lost: true };
    if (m.type === "pick") {
      const card = state.cards.find((c) => c.id === m.cardId);
      if (!card) throw new Error("No such card.");
      if (state.wrongPicks.includes(m.cardId)) throw new Error("Already tried that one.");
      const s = structuredClone(state);
      if ((card.counts[s.targetAnimal] ?? 0) === s.targetCount) {
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
      kind: "wheel",
      wheel: state.wheel,
      targetAnimal: state.targetAnimal,
      targetCount: state.targetCount,
      cards: state.cards.map((c) => ({ id: c.id, counts: c.counts })),
      round: state.round,
      roundsTotal: state.roundsTotal,
      subround: state.subround,
      subroundsTotal: state.subroundsTotal,
      roundMs: roundMs(state),
      lastRound: state.wheel.length <= 1,
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

  skipTurn(state): WheelState {
    return state;
  },
};
