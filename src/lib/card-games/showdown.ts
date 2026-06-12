/**
 * "Card Showdown" — a simultaneous bluffing game for 3–4 players. Everyone
 * starts with one each of cards 1–5. Each round all players SECRETLY pick one
 * or two cards and reveal at once. The highest total wins a ⭐ — but hands the
 * cards they played to the lowest player, who discards the cards THEY played.
 * Everyone else keeps their cards. Run out of cards and you're eliminated.
 * First to 3 ⭐ — or the last player standing — wins.
 *
 * Tie rules:
 *  - All players play the same total → a draw (no stars, no cards move).
 *  - Several tie for the lowest total → they ALL collect the winning set.
 *  - Several tie for the highest total → they each win a ⭐ and lose their
 *    played cards, which the lowest player(s) collect ALL of, combined.
 *
 * Unlike the other games there is no "turn": all active players commit, and the
 * round resolves once the last one has. `currentPlayer` therefore reports the
 * next player we're still waiting on, so the shared leave-mid-game handling can
 * auto-commit a default play for someone who has gone quiet.
 */
import { GameEngine, GameMode, PlayerRef, placeScore } from "./engine";

export type ShowdownResult = {
  plays: Record<number, number[]>;
  sums: Record<number, number>;
  draw: boolean; // every active player played the same total
  highIds: number[]; // player(s) with the highest total — each won a ⭐
  lowIds: number[]; // player(s) with the lowest total — each gained the set
  transferred: number[]; // the single set of cards the lowest player(s) gained
  discarded: number[]; // cards removed from the game this round
  eliminatedThisRound: number[];
};

export type ShowdownState = {
  kind: "showdown";
  mode: GameMode;
  order: number[];
  hands: Record<number, number[]>;
  stars: Record<number, number>;
  eliminated: number[]; // in elimination order (earliest first)
  selections: Record<number, number[] | null>; // this round's commits (null = pending)
  lastResult: ShowdownResult | null;
  winner: number | null;
};

type ShowdownMove = { type: "play"; cards: number[] };

const STARS_TO_WIN = 3;

function activeIds(s: ShowdownState): number[] {
  return s.order.filter((id) => !s.eliminated.includes(id));
}

function removeCards(hand: number[], cards: number[]): number[] | null {
  const copy = hand.slice();
  for (const c of cards) {
    const i = copy.indexOf(c);
    if (i === -1) return null;
    copy.splice(i, 1);
  }
  return copy;
}

/** Resolve the round in place once every active player has committed. */
function resolveIfReady(s: ShowdownState): void {
  const active = activeIds(s);
  if (active.length === 0 || active.some((id) => s.selections[id] == null)) return;

  const plays: Record<number, number[]> = {};
  const sums: Record<number, number> = {};
  for (const id of active) {
    plays[id] = s.selections[id]!;
    sums[id] = plays[id].reduce((a, b) => a + b, 0);
  }
  const maxSum = Math.max(...active.map((id) => sums[id]));
  const minSum = Math.min(...active.map((id) => sums[id]));
  const highIds = active.filter((id) => sums[id] === maxSum);
  const lowIds = active.filter((id) => sums[id] === minSum);

  const result: ShowdownResult = {
    plays,
    sums,
    draw: false,
    highIds: [],
    lowIds: [],
    transferred: [],
    discarded: [],
    eliminatedThisRound: [],
  };

  if (maxSum === minSum) {
    // Everyone played the same total — a draw. No stars, no cards move.
    result.draw = true;
  } else {
    result.highIds = highIds;
    result.lowIds = lowIds;
    for (const h of highIds) s.stars[h] = (s.stars[h] ?? 0) + 1;

    // The winner(s) lose their played cards; the lowest player(s) collect them.
    // With a single winner that's just their set; with several tied winners the
    // lowest player(s) collect ALL of those cards combined.
    const winningSet = highIds.flatMap((h) => plays[h]);
    for (const h of highIds) {
      s.hands[h] = removeCards(s.hands[h], plays[h]) ?? s.hands[h];
    }
    result.transferred = winningSet;

    // Each lowest player discards their own played cards and gains the set.
    for (const l of lowIds) {
      s.hands[l] = removeCards(s.hands[l], plays[l]) ?? s.hands[l];
      result.discarded.push(...plays[l]);
      s.hands[l] = [...s.hands[l], ...winningSet].sort((a, b) => a - b);
    }
    // Middle players keep their cards (never removed).
  }

  for (const id of s.order) s.selections[id] = null;

  // Start of the next turn: eliminate anyone now holding no cards.
  for (const id of activeIds(s)) {
    if ((s.hands[id]?.length ?? 0) === 0) {
      s.eliminated.push(id);
      result.eliminatedThisRound.push(id);
    }
  }
  s.lastResult = result;

  // Win checks: 3 stars first (counts even if that player just emptied out),
  // then last player standing.
  const starWinner = s.order.find((id) => (s.stars[id] ?? 0) >= STARS_TO_WIN);
  if (starWinner != null) {
    s.winner = starWinner;
    return;
  }
  const remaining = activeIds(s);
  if (remaining.length === 1) s.winner = remaining[0];
  else if (remaining.length === 0) s.winner = s.eliminated[s.eliminated.length - 1] ?? null;
}

export const showdown: GameEngine<ShowdownState> = {
  init(players: PlayerRef[], mode: GameMode): ShowdownState {
    const order = players.map((p) => p.id);
    const hands: Record<number, number[]> = {};
    const stars: Record<number, number> = {};
    const selections: Record<number, number[] | null> = {};
    for (const id of order) {
      hands[id] = [1, 2, 3, 4, 5];
      stars[id] = 0;
      selections[id] = null;
    }
    return { kind: "showdown", mode, order, hands, stars, eliminated: [], selections, lastResult: null, winner: null };
  },

  move(state, playerId, raw): ShowdownState {
    const m = raw as ShowdownMove;
    if (state.winner != null) throw new Error("The game is over.");
    if (state.eliminated.includes(playerId)) throw new Error("You're out of this game.");
    if (m.type !== "play") throw new Error("Unknown move.");
    if (state.selections[playerId] != null) throw new Error("You already locked in this round.");
    if (!Array.isArray(m.cards) || m.cards.length < 1 || m.cards.length > 2) {
      throw new Error("Play one or two cards.");
    }
    if (!removeCards(state.hands[playerId] ?? [], m.cards)) {
      throw new Error("You don't have those cards.");
    }
    const s: ShowdownState = structuredClone(state);
    s.selections[playerId] = [...m.cards];
    resolveIfReady(s);
    return s;
  },

  isOver(state): boolean {
    return state.winner != null;
  },

  winners(state): number[] {
    if (state.winner == null) return [];
    const rest = state.order.filter((id) => id !== state.winner);
    rest.sort((a, b) => {
      const sa = state.stars[a] ?? 0;
      const sb = state.stars[b] ?? 0;
      if (sa !== sb) return sb - sa; // more stars ranks higher
      // survivors (-1) above the eliminated; later elimination ranks higher
      const ka = state.eliminated.indexOf(a);
      const kb = state.eliminated.indexOf(b);
      return (kb === -1 ? Infinity : kb) - (ka === -1 ? Infinity : ka);
    });
    return [state.winner, ...rest];
  },

  view(state, viewerId): unknown {
    const active = activeIds(state);
    return {
      kind: "showdown",
      stars: state.stars,
      eliminated: state.eliminated,
      active,
      handCounts: Object.fromEntries(state.order.map((id) => [id, (state.hands[id] ?? []).length])),
      yourHand: state.hands[viewerId] ?? [],
      youEliminated: state.eliminated.includes(viewerId),
      yourSelection: state.selections[viewerId] ?? null,
      committed: Object.fromEntries(active.map((id) => [id, state.selections[id] != null])),
      waitingOn: active.filter((id) => state.selections[id] == null).length,
      lastResult: state.lastResult,
      starsToWin: STARS_TO_WIN,
      // Not a turn-based game; these satisfy the shared board's union but the
      // standard turn banner is skipped for showdown.
      turnPlayerId: -1,
      yourTurn: !state.eliminated.includes(viewerId) && state.selections[viewerId] == null,
    };
  },

  scoreFor(state, playerId): number {
    if (!this.isOver(state)) return 0;
    return placeScore(this.winners(state).indexOf(playerId), state.order.length);
  },

  currentPlayer(state): number {
    // The next active player we're still waiting on (for absent-skip handling).
    const pending = activeIds(state).find((id) => state.selections[id] == null);
    return pending ?? state.order[0];
  },

  skipTurn(state, playerId): ShowdownState {
    // Auto-commit a default play (lowest single card) for an absent player so
    // the round can resolve without them.
    if (state.eliminated.includes(playerId) || state.selections[playerId] != null) return state;
    const hand = state.hands[playerId] ?? [];
    if (hand.length === 0) return state;
    const s: ShowdownState = structuredClone(state);
    s.selections[playerId] = [Math.min(...hand)];
    resolveIfReady(s);
    return s;
  },
};
