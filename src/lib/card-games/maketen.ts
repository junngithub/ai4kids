/**
 * "Make Ten" — a solo number-bonds race. The board is a set of face-up cards; the
 * player clears them two at a time by tapping pairs that sum to 10. The deck is
 * built only from number bonds that total 10, so the board is always clearable to
 * empty (every value keeps its complement balanced — no dead ends).
 *
 * Each pair is one timed `round` with a shrinking budget (8s on the first pair,
 * −0.4s per round down to a 3s floor). Unlike the turn-based games the COUNTDOWN
 * lives on the client: the board runs it and POSTs a `timeout` move when it hits
 * zero, which ends the game as a LOSS (`lost`, no winner, no best time recorded).
 * A `clear` move names two card ids whose values add to 10.
 */
import { GameEngine, GameMode, PlayerRef, shuffle } from "./engine";

type MakeTenCard = { id: number; v: number };

export type MakeTenState = {
  kind: "maketen";
  pid: number;
  cards: MakeTenCard[];
  goal: number; // pairs to clear
  done: boolean;
  lost: boolean;
};

type MakeTenMove = { type: "clear"; cards: number[] } | { type: "timeout" };

/** Number bonds that sum to 10 — the only pairs the deck is built from. */
const BONDS: [number, number][] = [
  [1, 9], [2, 8], [3, 7], [4, 6], [5, 5],
];
const GOAL = 12; // 12 pairs = 24 cards
const START_MS = 8_000;
const STEP_MS = 400;
const FLOOR_MS = 3_000;

/** Per-round time budget: tightens as the board clears, down to a floor. */
function budgetFor(round: number): number {
  return Math.max(FLOOR_MS, START_MS - (round - 1) * STEP_MS);
}

export const maketen: GameEngine<MakeTenState> = {
  init(players: PlayerRef[], _mode: GameMode): MakeTenState {
    const cards: MakeTenCard[] = [];
    let id = 0;
    for (let i = 0; i < GOAL; i++) {
      const [a, b] = BONDS[Math.floor(Math.random() * BONDS.length)];
      cards.push({ id: id++, v: a }, { id: id++, v: b });
    }
    return { kind: "maketen", pid: players[0].id, cards: shuffle(cards), goal: GOAL, done: false, lost: false };
  },

  move(state, _playerId, raw): MakeTenState {
    if (state.done || state.lost) throw new Error("The game is over.");
    const m = raw as MakeTenMove;
    if (m.type === "timeout") return { ...state, lost: true };
    if (m.type === "clear") {
      const ids = m.cards;
      if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) throw new Error("Pick two different cards.");
      const a = state.cards.find((c) => c.id === ids[0]);
      const b = state.cards.find((c) => c.id === ids[1]);
      if (!a || !b) throw new Error("No such card.");
      if (a.v + b.v !== 10) throw new Error(`${a.v} + ${b.v} = ${a.v + b.v}, not 10.`);
      const cards = state.cards.filter((c) => c.id !== a.id && c.id !== b.id);
      return { ...state, cards, done: cards.length === 0 };
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
    const cleared = state.goal - state.cards.length / 2;
    const round = cleared + 1;
    return {
      kind: "maketen",
      cards: state.cards.map((c) => ({ id: c.id, value: c.v })),
      cleared,
      goal: state.goal,
      round,
      roundMs: budgetFor(round),
      turnPlayerId: state.pid,
      yourTurn: viewerId === state.pid,
      finished: state.done ? [state.pid] : [],
    };
  },

  scoreFor(state, _playerId): number {
    if (!this.isOver(state)) return 0;
    if (state.lost) {
      const cleared = state.goal - state.cards.length / 2;
      return Math.round((cleared / state.goal) * 70);
    }
    return 100;
  },

  currentPlayer(state): number {
    return state.pid;
  },

  skipTurn(state): MakeTenState {
    return state; // solo — nobody to skip
  },
};
