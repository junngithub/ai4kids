/**
 * "Beat the Die" — a press-your-luck discard race. Every card is valued 1–4.
 * On your turn you roll a 6-sided die, then discard ONE or TWO cards whose
 * values add up to AT LEAST the number rolled ("beat the die"). If you can't,
 * you draw a card. First to empty their hand wins; solo mode is a time attack.
 *
 * Each player starts with 12 cards — three of each value 1–4 — and the shared
 * draw pile holds 40 (ten of each). Discarded cards leave the game, but because
 * a roll of 1 lets any card go, every player can always make progress, so the
 * race ends.
 */
import {
  GameEngine,
  GameMode,
  PlayerRef,
  shuffle,
  nextTurn,
  placeScore,
} from "./engine";

export type BeatDieState = {
  kind: "beatdie";
  mode: GameMode;
  order: number[];
  turn: number;
  die: number | null; // current roll for the player on turn; null = not rolled
  hands: Record<number, number[]>;
  draw: number[];
  finished: number[];
};

type BeatDieMove =
  | { type: "roll" }
  | { type: "discard"; cards: number[] } // 1 or 2 values, summing ≥ die
  | { type: "draw" };

const HAND_PER_VALUE = 3; // 3 of each value 1–4 → a 12-card starting hand
const DRAW_PER_VALUE = 10; // 10 of each value 1–4 → a 40-card draw pile

/** Can this hand beat the die with one card, or two cards' sum? */
function canBeat(hand: number[], die: number): boolean {
  if (hand.some((c) => c >= die)) return true;
  if (hand.length < 2) return false;
  const top2 = [...hand].sort((a, b) => b - a).slice(0, 2);
  return top2[0] + top2[1] >= die;
}

function removeFromHand(hand: number[], cards: number[]): number[] | null {
  const copy = hand.slice();
  for (const c of cards) {
    const i = copy.indexOf(c);
    if (i === -1) return null;
    copy.splice(i, 1);
  }
  return copy;
}

export const beatdie: GameEngine<BeatDieState> = {
  init(players: PlayerRef[], mode: GameMode): BeatDieState {
    const order = players.map((p) => p.id);
    // Every player starts with the same 12-card hand: three of each value 1–4.
    const hands: Record<number, number[]> = {};
    for (const id of order) {
      const h: number[] = [];
      for (let v = 1; v <= 4; v++) for (let i = 0; i < HAND_PER_VALUE; i++) h.push(v);
      hands[id] = h; // already sorted ascending
    }
    // Shared draw pile: ten of each value 1–4 (40 cards), shuffled.
    const pool: number[] = [];
    for (let v = 1; v <= 4; v++) for (let i = 0; i < DRAW_PER_VALUE; i++) pool.push(v);
    const draw = shuffle(pool);
    return { kind: "beatdie", mode, order, turn: 0, die: null, hands, draw, finished: [] };
  },

  move(state, playerId, raw): BeatDieState {
    const m = raw as BeatDieMove;
    if (state.order[state.turn] !== playerId) throw new Error("It's not your turn.");
    const s: BeatDieState = structuredClone(state);
    const hand = s.hands[playerId] ?? [];

    if (m.type === "roll") {
      if (s.die != null) throw new Error("You already rolled — now discard or draw.");
      s.die = 1 + Math.floor(Math.random() * 6);
      return s;
    }

    if (s.die == null) throw new Error("Roll the die first.");

    if (m.type === "discard") {
      if (!Array.isArray(m.cards) || m.cards.length < 1 || m.cards.length > 2) {
        throw new Error("Pick one or two cards.");
      }
      const sum = m.cards.reduce((a, b) => a + b, 0);
      if (sum < s.die) throw new Error(`That only makes ${sum} — you need to beat ${s.die}.`);
      const left = removeFromHand(hand, m.cards);
      if (!left) throw new Error("You don't have those cards.");
      s.hands[playerId] = left;
      if (left.length === 0 && !s.finished.includes(playerId)) s.finished.push(playerId);
      s.die = null;
      s.turn = nextTurn(s.order, s.turn, s.finished);
      return s;
    }

    if (m.type === "draw") {
      if (canBeat(hand, s.die)) throw new Error("You can beat the die — discard instead!");
      if (s.draw.length > 0) {
        hand.push(s.draw.shift()!);
        hand.sort((a, b) => a - b);
        s.hands[playerId] = hand;
      }
      s.die = null;
      s.turn = nextTurn(s.order, s.turn, s.finished);
      return s;
    }

    throw new Error("Unknown move.");
  },

  isOver(state): boolean {
    if (state.mode === "solo") return state.finished.length >= 1;
    return state.finished.length >= state.order.length - 1;
  },

  winners(state): number[] {
    if (!this.isOver(state)) return [];
    const stragglers = state.order
      .filter((id) => !state.finished.includes(id))
      .sort((a, b) => (state.hands[a]?.length ?? 0) - (state.hands[b]?.length ?? 0));
    return [...state.finished, ...stragglers];
  },

  view(state, viewerId): unknown {
    const yourHand = state.hands[viewerId] ?? [];
    return {
      kind: "beatdie",
      die: state.die,
      drawCount: state.draw.length,
      yourHand,
      hands: Object.fromEntries(state.order.map((id) => [id, (state.hands[id] ?? []).length])),
      turnPlayerId: state.order[state.turn],
      yourTurn: state.order[state.turn] === viewerId,
      finished: state.finished,
      // Only meaningful once rolled: may this viewer still beat the die?
      canBeat: state.die != null ? canBeat(yourHand, state.die) : true,
    };
  },

  scoreFor(state, playerId): number {
    if (!this.isOver(state)) return 0;
    return placeScore(this.winners(state).indexOf(playerId), state.order.length);
  },

  currentPlayer(state): number {
    return state.order[state.turn];
  },

  skipTurn(state, playerId): BeatDieState {
    if (state.order[state.turn] !== playerId) return state;
    const s: BeatDieState = structuredClone(state);
    s.die = null;
    s.turn = nextTurn(s.order, s.turn, s.finished);
    return s;
  },
};
