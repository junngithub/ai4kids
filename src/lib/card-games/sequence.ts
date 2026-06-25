/**
 * "Alphabet Lock" — a solo memory game. Nine consecutive letters hide face-down
 * in a 3×3 grid; the player flips them in alphabetical order. A correct flip
 * stays up (progress climbs); a wrong flip reveals that letter briefly, then a
 * `hide` move flips every card back down (reset to the start). Flip all nine in
 * order to crack the lock and win.
 *
 * There is no timer, so this game has no loss state — the player wins once all
 * nine are revealed in order. The brief reveal-then-hide on a wrong flip is owned
 * by the client (the board waits, then POSTs the `hide` move).
 */
import { GameEngine, GameMode, PlayerRef, shuffle } from "./engine";

type SeqCard = { id: number; letter: string };

export type SeqState = {
  kind: "sequence";
  pid: number;
  order: string[]; // the nine letters in alphabetical order
  cards: SeqCard[]; // same letters shuffled into grid slots
  revealed: number[]; // correctly-flipped prefix (card ids, in flip order)
  wrongCard: number | null;
  done: boolean;
};

type SeqMove = { type: "flip"; cardId: number } | { type: "hide" };

const TOTAL = 9;

export const sequence: GameEngine<SeqState> = {
  init(players: PlayerRef[], _mode: GameMode): SeqState {
    const start = Math.floor(Math.random() * (26 - TOTAL + 1)); // first letter, A..R
    const order = Array.from({ length: TOTAL }, (_, i) => String.fromCharCode(65 + start + i));
    const cards = shuffle(order).map((letter, i) => ({ id: i, letter }));
    return { kind: "sequence", pid: players[0].id, order, cards, revealed: [], wrongCard: null, done: false };
  },

  move(state, _playerId, raw): SeqState {
    if (state.done) throw new Error("The game is over.");
    const m = raw as SeqMove;
    if (m.type === "hide") {
      return { ...state, revealed: [], wrongCard: null };
    }
    if (m.type === "flip") {
      if (state.wrongCard !== null) return state; // locked while a wrong card is shown
      const card = state.cards.find((c) => c.id === m.cardId);
      if (!card) return state;
      if (state.revealed.includes(m.cardId)) return state;
      if (card.letter === state.order[state.revealed.length]) {
        const revealed = [...state.revealed, m.cardId];
        return { ...state, revealed, done: revealed.length === TOTAL };
      }
      return { ...state, wrongCard: m.cardId };
    }
    throw new Error("Unknown move.");
  },

  isOver(state): boolean {
    return state.done;
  },

  winners(state): number[] {
    return state.done ? [state.pid] : [];
  },

  view(state, viewerId): unknown {
    return {
      kind: "sequence",
      cards: state.cards.map((c) => ({
        id: c.id,
        letter: c.letter,
        faceUp: state.revealed.includes(c.id) || c.id === state.wrongCard,
        wrong: c.id === state.wrongCard,
      })),
      order: state.order,
      progress: state.revealed.length,
      total: TOTAL,
      wrong: state.wrongCard !== null,
      turnPlayerId: state.pid,
      yourTurn: viewerId === state.pid,
      finished: state.done ? [state.pid] : [],
    };
  },

  scoreFor(state, _playerId): number {
    return state.done ? 100 : 0;
  },

  currentPlayer(state): number {
    return state.pid;
  },

  skipTurn(state): SeqState {
    return state;
  },
};