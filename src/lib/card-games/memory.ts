/**
 * Memory matching card game — solo, co-op (clear the board as a team) and
 * versus (most pairs wins).
 *
 * Two sets of cards are laid out shuffled in a grid: a WORD card and an EMOJI
 * card for each concept. A match is a word and its matching emoji (e.g. the
 * word "plant" with 🌱). On your turn you flip two cards; a match keeps your
 * turn, a miss passes it to the next player after a short reveal.
 */
import {
  GameEngine,
  GameMode,
  PlayerRef,
  shuffle,
  nextTurn,
  placeScore,
} from "./engine";

/** Word ↔ emoji concept bank. Eight pairs are picked per game (a 4×4 grid). */
const CONCEPTS: { word: string; emoji: string }[] = [
  { word: "plant", emoji: "🌱" },
  { word: "star", emoji: "⭐" },
  { word: "rocket", emoji: "🚀" },
  { word: "robot", emoji: "🤖" },
  { word: "apple", emoji: "🍎" },
  { word: "cat", emoji: "🐱" },
  { word: "fish", emoji: "🐟" },
  { word: "sun", emoji: "☀️" },
  { word: "moon", emoji: "🌙" },
  { word: "tree", emoji: "🌳" },
  { word: "car", emoji: "🚗" },
  { word: "ball", emoji: "⚽" },
  { word: "cake", emoji: "🍰" },
  { word: "dog", emoji: "🐶" },
  { word: "frog", emoji: "🐸" },
  { word: "boat", emoji: "⛵" },
];

const PAIRS = 8; // 16 cards → 4×4 grid

export type MemoryCard = {
  id: number;
  concept: number; // index into the chosen concepts
  face: "word" | "emoji";
  label: string;
};

export type MemoryState = {
  kind: "memory";
  mode: GameMode;
  order: number[];
  turn: number;
  cards: MemoryCard[]; // grid order
  matchedBy: Record<number, number>; // cardId -> playerId
  flipped: number[]; // currently face-up + unresolved (0..2 card ids)
  mismatch: boolean; // two flipped that don't match, awaiting "next"
  scores: Record<number, number>; // playerId -> pairs found
  flips: number; // total flips taken (solo efficiency)
};

type MemoryMove =
  | { type: "flip"; cardId: number }
  | { type: "next" };

function totalPairs() {
  return PAIRS;
}

export const memory: GameEngine<MemoryState> = {
  init(players: PlayerRef[], mode: GameMode): MemoryState {
    const chosen = shuffle(CONCEPTS).slice(0, PAIRS);
    const cards: MemoryCard[] = [];
    let id = 0;
    chosen.forEach((c, ci) => {
      cards.push({ id: id++, concept: ci, face: "word", label: c.word });
      cards.push({ id: id++, concept: ci, face: "emoji", label: c.emoji });
    });
    const order = players.map((p) => p.id);
    return {
      kind: "memory",
      mode,
      order,
      turn: 0,
      cards: shuffle(cards),
      matchedBy: {},
      flipped: [],
      mismatch: false,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      flips: 0,
    };
  },

  move(state, playerId, raw): MemoryState {
    const m = raw as MemoryMove;
    if (state.order[state.turn] !== playerId) throw new Error("It's not your turn.");
    const s: MemoryState = structuredClone(state);

    if (m.type === "next") {
      if (!s.mismatch) throw new Error("Nothing to clear.");
      s.flipped = [];
      s.mismatch = false;
      s.turn = nextTurn(s.order, s.turn, []);
      return s;
    }

    if (m.type !== "flip") throw new Error("Unknown move.");
    if (s.mismatch) {
      // Auto-resolve a stale mismatch before flipping (defensive).
      s.flipped = [];
      s.mismatch = false;
    }
    const card = s.cards.find((c) => c.id === m.cardId);
    if (!card) throw new Error("No such card.");
    if (s.matchedBy[card.id] != null) throw new Error("That pair is already found.");
    if (s.flipped.includes(card.id)) throw new Error("That card is already up.");
    if (s.flipped.length >= 2) throw new Error("Tap to clear first.");

    s.flipped.push(card.id);
    s.flips += 1;

    if (s.flipped.length === 2) {
      const [a, b] = s.flipped.map((id) => s.cards.find((c) => c.id === id)!);
      if (a.concept === b.concept) {
        // Match — lock the pair, score, keep the turn.
        s.matchedBy[a.id] = playerId;
        s.matchedBy[b.id] = playerId;
        s.scores[playerId] = (s.scores[playerId] ?? 0) + 1;
        s.flipped = [];
      } else {
        // Miss — leave both up; client sends "next" to flip back + pass turn.
        s.mismatch = true;
      }
    }
    return s;
  },

  isOver(state): boolean {
    return Object.keys(state.matchedBy).length >= totalPairs() * 2;
  },

  winners(state): number[] {
    if (!this.isOver(state)) return [];
    if (state.mode === "coop" || state.mode === "solo") return state.order.slice();
    // versus: rank by pairs found (desc).
    return state.order
      .slice()
      .sort((a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0));
  },

  view(state, viewerId): unknown {
    return {
      kind: "memory",
      cards: state.cards.map((c) => {
        const matched = state.matchedBy[c.id] != null;
        const up = matched || state.flipped.includes(c.id);
        return {
          id: c.id,
          face: c.face,
          // Only reveal the label for face-up / matched cards.
          label: up ? c.label : null,
          matched,
          flipped: state.flipped.includes(c.id),
          matchedBy: matched ? state.matchedBy[c.id] : null,
        };
      }),
      turnPlayerId: state.order[state.turn],
      yourTurn: state.order[state.turn] === viewerId,
      mismatch: state.mismatch,
      scores: state.scores,
      flips: state.flips,
      pairsTotal: totalPairs(),
      pairsFound: Object.keys(state.matchedBy).length / 2,
    };
  },

  scoreFor(state, playerId): number {
    if (!this.isOver(state)) return 0;
    if (state.mode === "solo") {
      // Fewer flips = better. Perfect is 2*pairs flips.
      const perfect = totalPairs() * 2;
      const ratio = perfect / Math.max(perfect, state.flips);
      return Math.max(50, Math.round(ratio * 100));
    }
    if (state.mode === "coop") return 100; // cleared the board together
    const ranked = this.winners(state);
    return placeScore(ranked.indexOf(playerId), state.order.length);
  },
};
