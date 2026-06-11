/**
 * "Number Hunt" — a make-the-target math game. There is a draw pile, a discard
 * pile and a TARGET number. On your turn you discard one card that equals the
 * target, or two cards whose sum OR difference equals the target. Can't (or
 * won't) play? Draw a card and pass. First to empty their hand wins; solo is a
 * time attack.
 *
 * Deck: 40 cards (1–10 ×4). One seeds the discard pile, five go to each player,
 * the rest form the draw pile (which reshuffles from the discard when empty).
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

export type MathState = {
  kind: "math";
  mode: GameMode;
  order: number[];
  turn: number;
  target: number;
  draw: number[];
  discardTop: number;
  discardPile: number[]; // full pile incl. top (for reshuffling)
  hands: Record<number, number[]>;
  finished: number[];
  lowWater: number; // fewest total cards held by active players seen so far
  sinceProgress: number; // turns since lowWater last improved (stall detector)
  dead: boolean; // unsolvable end — no one can ever reach any target
};

type MathMove =
  | { type: "discard"; cards: number[] } // 1 or 2 values
  | { type: "draw" };

const HAND = 5;

/** Does this set of 1–2 cards make the target? */
export function makesTarget(cards: number[], target: number): boolean {
  if (cards.length === 1) return cards[0] === target;
  if (cards.length === 2) {
    const [a, b] = cards;
    return a + b === target || Math.abs(a - b) === target;
  }
  return false;
}

/** Can this hand make the target with any single card or any pair? */
function canDiscard(hand: number[], target: number): boolean {
  if (hand.includes(target)) return true;
  for (let i = 0; i < hand.length; i++)
    for (let j = i + 1; j < hand.length; j++)
      if (makesTarget([hand[i], hand[j]], target)) return true;
  return false;
}

/** Targets (2–9) at least one active player can currently play. */
function achievableTargets(state: MathState, activeIds: number[]): number[] {
  const out: number[] = [];
  for (let t = 2; t <= 9; t++) {
    if (activeIds.some((id) => canDiscard(state.hands[id] ?? [], t))) out.push(t);
  }
  return out;
}

/** Targets (2–9) this one player can play. */
function achievableForPlayer(state: MathState, id: number): number[] {
  const out: number[] = [];
  for (let t = 2; t <= 9; t++) if (canDiscard(state.hands[id] ?? [], t)) out.push(t);
  return out;
}

/**
 * Liveness valve. A fixed target can leave everyone holding cards that can
 * never reach it (a stall) — or let occasional single discards cycle forever
 * without anyone emptying their hand (a livelock). We track the fewest total
 * cards active players have ever held; if that floor doesn't drop for a few
 * rounds, we refresh the target to one the player on turn can actually make
 * (a kid-friendly "new target!"). Because each refresh forces a discard that
 * pushes the floor strictly lower, the game is guaranteed to end.
 */
function relief(s: MathState): MathState {
  const active = s.order.filter((id) => !s.finished.includes(id));
  if (active.length === 0) return s;
  const total = active.reduce((t, id) => t + (s.hands[id]?.length ?? 0), 0);
  if (total < s.lowWater) {
    s.lowWater = total;
    s.sinceProgress = 0;
    return s;
  }
  s.sinceProgress += 1;
  if (s.sinceProgress < active.length * 4) return s;

  // Stalled — refresh the target so the player on turn can move.
  const nextId = s.order[s.turn];
  const forNext = achievableForPlayer(s, nextId);
  const pool = forNext.length ? forNext : achievableTargets(s, active);
  const fresh = pool.filter((t) => t !== s.target);
  if (fresh.length) s.target = fresh[Math.floor(Math.random() * fresh.length)];
  else if (pool.length) s.target = pool[0];
  else s.dead = true; // genuinely no reachable target for anyone
  s.sinceProgress = 0;
  return s;
}

/** Remove the given values (by value, one each) from a hand copy. */
function removeFromHand(hand: number[], cards: number[]): number[] | null {
  const copy = hand.slice();
  for (const c of cards) {
    const i = copy.indexOf(c);
    if (i === -1) return null;
    copy.splice(i, 1);
  }
  return copy;
}

export const math: GameEngine<MathState> = {
  init(players: PlayerRef[], mode: GameMode): MathState {
    const deck = shuffle(makeDeck()).map((c) => c.v);
    const order = players.map((p) => p.id);
    const hands: Record<number, number[]> = {};
    let k = 0;
    order.forEach((id) => (hands[id] = []));
    for (let r = 0; r < HAND; r++) {
      for (const id of order) hands[id].push(deck[k++]);
    }
    const discardTop = deck[k++];
    const draw = deck.slice(k);
    // Target 2–9: always reachable with 1–10 cards by value or by sum/difference.
    const target = 2 + Math.floor(Math.random() * 8);
    order.forEach((id) => hands[id].sort((a, b) => a - b));
    return {
      kind: "math",
      mode,
      order,
      turn: 0,
      target,
      draw,
      discardTop,
      discardPile: [discardTop],
      hands,
      finished: [],
      lowWater: order.length * HAND,
      sinceProgress: 0,
      dead: false,
    };
  },

  move(state, playerId, raw): MathState {
    const m = raw as MathMove;
    if (state.order[state.turn] !== playerId) throw new Error("It's not your turn.");
    const s: MathState = structuredClone(state);
    const hand = s.hands[playerId] ?? [];

    if (m.type === "discard") {
      if (!Array.isArray(m.cards) || m.cards.length < 1 || m.cards.length > 2) {
        throw new Error("Pick one or two cards.");
      }
      if (!makesTarget(m.cards, s.target)) {
        throw new Error(`Those don't make ${s.target}. Try one card = ${s.target}, or two that add/subtract to it.`);
      }
      const left = removeFromHand(hand, m.cards);
      if (!left) throw new Error("You don't have those cards.");
      s.hands[playerId] = left;
      s.discardPile.push(...m.cards);
      s.discardTop = m.cards[m.cards.length - 1];
      if (left.length === 0 && !s.finished.includes(playerId)) s.finished.push(playerId);
      s.turn = nextTurn(s.order, s.turn, s.finished);
      return relief(s);
    }

    if (m.type === "draw") {
      if (s.draw.length === 0) {
        // Reshuffle the discard (minus its visible top) back into the draw pile.
        const top = s.discardPile.pop();
        s.draw = shuffle(s.discardPile);
        s.discardPile = top != null ? [top] : [];
        s.discardTop = top ?? s.discardTop;
      }
      if (s.draw.length > 0) {
        hand.push(s.draw.shift()!);
        hand.sort((a, b) => a - b);
        s.hands[playerId] = hand;
      }
      s.turn = nextTurn(s.order, s.turn, s.finished);
      return relief(s);
    }

    throw new Error("Unknown move.");
  },

  isOver(state): boolean {
    if (state.dead) return true;
    if (state.mode === "solo") return state.finished.length >= 1;
    return state.finished.length >= state.order.length - 1;
  },

  winners(state): number[] {
    if (!this.isOver(state)) return [];
    // Finishers first (in finish order), then the rest by fewest cards held.
    const stragglers = state.order
      .filter((id) => !state.finished.includes(id))
      .sort((a, b) => (state.hands[a]?.length ?? 0) - (state.hands[b]?.length ?? 0));
    return [...state.finished, ...stragglers];
  },

  view(state, viewerId): unknown {
    return {
      kind: "math",
      target: state.target,
      discardTop: state.discardTop,
      drawCount: state.draw.length,
      yourHand: state.hands[viewerId] ?? [],
      hands: Object.fromEntries(
        state.order.map((id) => [id, (state.hands[id] ?? []).length]),
      ),
      turnPlayerId: state.order[state.turn],
      yourTurn: state.order[state.turn] === viewerId,
      finished: state.finished,
    };
  },

  scoreFor(state, playerId): number {
    if (!this.isOver(state)) return 0;
    return placeScore(this.winners(state).indexOf(playerId), state.order.length);
  },
};
