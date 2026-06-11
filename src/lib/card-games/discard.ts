/**
 * "Tower Tumble" — a climbing discard game. Four discard piles sit in the
 * middle; on your turn you place a card that is HIGHER than the pile's current
 * top, or play a 10 to clear a pile (resetting it so any card can go next).
 * First to empty their hand wins. Solo mode is a time attack.
 *
 * Deck: 40 cards (1–10 ×4). Four cards seed the four piles; the rest are dealt
 * evenly. If everyone passes in a full round (nobody can move) all piles reset
 * — a kid-friendly way to break the rare deadlock without a draw pile.
 */
import {
  GameEngine,
  GameMode,
  PlayerRef,
  makeDeck,
  shuffle,
  nextTurn,
  placeScore,
} from "./engine";

export type DiscardState = {
  kind: "discard";
  mode: GameMode;
  order: number[];
  turn: number;
  piles: number[]; // 4 tops, 0 = cleared (any card playable)
  hands: Record<number, number[]>; // playerId -> card values
  passStreak: number;
  finished: number[]; // playerIds in finish order
};

type DiscardMove =
  | { type: "play"; pile: number; card: number }
  | { type: "pass" };

const PILES = 4;

/** Can this hand play any card on any pile? (a 10 is always playable) */
function hasLegalMove(hand: number[], piles: number[]): boolean {
  return hand.some((c) => c === 10 || piles.some((top) => c > top));
}

export const discard: GameEngine<DiscardState> = {
  init(players: PlayerRef[], mode: GameMode): DiscardState {
    const deck = shuffle(makeDeck());
    // Seed the four piles, but never start a pile on a 10: a 10 can only be
    // beaten by another 10, so a seeded 10 is an unbeatable, dead pile from the
    // off (the cause of the early-game softlock). Treat a seeded 10 as cleared
    // (top 0 = any card plays). Pile tops can otherwise never reach 10, because
    // playing a 10 always CLEARS a pile rather than landing on top — so with
    // this one fix no pile is ever permanently locked.
    const piles = deck.slice(0, PILES).map((c) => (c.v === 10 ? 0 : c.v));
    const rest = deck.slice(PILES);
    const order = players.map((p) => p.id);
    const each = Math.floor(rest.length / order.length);
    const hands: Record<number, number[]> = {};
    order.forEach((id, i) => {
      hands[id] = rest.slice(i * each, i * each + each).map((c) => c.v).sort((a, b) => a - b);
    });
    return {
      kind: "discard",
      mode,
      order,
      turn: 0,
      piles,
      hands,
      passStreak: 0,
      finished: [],
    };
  },

  move(state, playerId, raw): DiscardState {
    const m = raw as DiscardMove;
    if (state.order[state.turn] !== playerId) throw new Error("It's not your turn.");
    const s: DiscardState = structuredClone(state);
    const hand = s.hands[playerId] ?? [];

    if (m.type === "play") {
      if (m.pile < 0 || m.pile >= PILES) throw new Error("Pick a pile.");
      const idx = hand.indexOf(m.card);
      if (idx === -1) throw new Error("You don't have that card.");
      const top = s.piles[m.pile];
      const legal = m.card === 10 || m.card > top;
      if (!legal) throw new Error(`Play a card higher than ${top}, or a 10 to clear.`);
      hand.splice(idx, 1);
      s.piles[m.pile] = m.card === 10 ? 0 : m.card; // a 10 clears the pile
      s.passStreak = 0;
      if (hand.length === 0 && !s.finished.includes(playerId)) s.finished.push(playerId);
      s.turn = nextTurn(s.order, s.turn, s.finished);
      return s;
    }

    if (m.type === "pass") {
      if (hasLegalMove(hand, s.piles)) throw new Error("You have a move — play a card!");
      s.passStreak += 1;
      const active = s.order.filter((id) => !s.finished.includes(id)).length;
      if (s.passStreak >= active) {
        s.piles = Array(PILES).fill(0); // everyone stuck — reset the towers
        s.passStreak = 0;
      }
      s.turn = nextTurn(s.order, s.turn, s.finished);
      return s;
    }

    throw new Error("Unknown move.");
  },

  isOver(state): boolean {
    if (state.mode === "solo") return state.finished.length >= 1;
    // Versus: ends when only one player still holds cards.
    return state.finished.length >= state.order.length - 1;
  },

  winners(state): number[] {
    if (!this.isOver(state)) return [];
    const stragglers = state.order.filter((id) => !state.finished.includes(id));
    return [...state.finished, ...stragglers];
  },

  view(state, viewerId): unknown {
    return {
      kind: "discard",
      piles: state.piles,
      yourHand: state.hands[viewerId] ?? [],
      hands: Object.fromEntries(
        state.order.map((id) => [id, (state.hands[id] ?? []).length]),
      ),
      turnPlayerId: state.order[state.turn],
      yourTurn: state.order[state.turn] === viewerId,
      finished: state.finished,
      canPlay: hasLegalMove(state.hands[viewerId] ?? [], state.piles),
    };
  },

  scoreFor(state, playerId): number {
    if (!this.isOver(state)) return 0;
    return placeScore(this.winners(state).indexOf(playerId), state.order.length);
  },

  currentPlayer(state): number {
    return state.order[state.turn];
  },

  skipTurn(state, playerId): DiscardState {
    if (state.order[state.turn] !== playerId) return state;
    const s: DiscardState = structuredClone(state);
    // A leaver's turn is just passed on (don't count it toward the all-stuck
    // pile reset — that's for genuinely blocked play, not absence).
    s.turn = nextTurn(s.order, s.turn, s.finished);
    return s;
  },
};
