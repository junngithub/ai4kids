/**
 * "Matching Colours" — a real-time reaction race for 2–4 players. Every player
 * holds the same four colour cards (Red / Blue / Green / Yellow). At the start
 * of each round the four colours are randomly tied to the numbers 1–4 and shown
 * during a 3-second countdown. Then one number (1–4) is called and players race
 * to tap the colour card it maps to within 5 seconds. The fastest correct tap
 * scores 3, the second 2, any other correct tap 1, a wrong/late tap 0. Ten
 * rounds; highest total wins. A tie at the top triggers a sudden-death final
 * round among the tied players, repeated until one is fastest.
 *
 * Unlike the turn-based games this one is CLOCK-DRIVEN, so it leans on two extra
 * pieces of the engine plumbing:
 *  - `move()` stamps each answer with the server's arrival time (`Date.now()`),
 *    and the move route's row lock serialises simultaneous taps into a fair
 *    fastest/second order. Answers outside the [revealAt, deadlineAt] window are
 *    rejected.
 *  - `tick(state, now)` resolves a round once its 5s window closes (or everyone
 *    has answered) and advances to the next round after a short result pause. It
 *    is called on every poll via `maybeTick` in card-session.ts.
 *
 * The client reveals the called number off the shared `revealAt` clock (the view
 * ships absolute ms-epoch timestamps + `serverNow` so each client can correct
 * for its own clock skew), which keeps the reveal fair despite the ~1.2s poll
 * cadence. The number is therefore present in the polled payload during the
 * preview; the server still refuses taps before `revealAt`.
 */
import { GameEngine, GameMode, PlayerRef, placeScore, shuffle } from "./engine";

/** The four distinct colour cards every player holds. Index = colour id. */
export const COLOURS = [
  { key: "red", label: "Red", hex: "#ef4444", emoji: "🟥" },
  { key: "blue", label: "Blue", hex: "#3b82f6", emoji: "🟦" },
  { key: "green", label: "Green", hex: "#22c55e", emoji: "🟩" },
  { key: "yellow", label: "Yellow", hex: "#eab308", emoji: "🟨" },
] as const;

const PREVIEW_MS = 3000; // countdown showing the colour↔number mapping
const ANSWER_MS = 5000; // window to tap the right colour
const RESULT_MS = 3000; // pause showing the round result before the next round
const ROUNDS = 10;
/** Safety cap so a tie nobody ever breaks (e.g. an abandoned game) still ends. */
const MAX_FINAL_ROUNDS = 6;

type Round = {
  n: number; // 1-based display index (regular: 1..10; final: 1, 2, …)
  final: boolean; // sudden-death tiebreak round?
  pool: number[]; // participants (everyone, or the tied finalists)
  mapping: number[]; // mapping[i] = colour id tied to number (i + 1)
  prompt: number; // the called number, 1..4
  startAt: number; // preview begins (ms epoch)
  revealAt: number; // startAt + PREVIEW_MS — taps open
  deadlineAt: number; // revealAt + ANSWER_MS — taps close
  resolved: boolean; // scored yet?
  resultUntil: number | null; // show the result until this ms epoch, then advance
  answers: Record<number, { colour: number; at: number }>; // colour -1 = no answer
  points: Record<number, number>; // points earned THIS round (for the result)
};

export type MatchColoursState = {
  kind: "matchcolours";
  mode: GameMode;
  order: number[];
  scores: Record<number, number>; // cumulative
  roundsTotal: number;
  round: Round;
  winner: number | null;
};

type MatchColoursMove = { type: "tap"; colour: number };

function makeRound(pool: number[], final: boolean, n: number, now: number): Round {
  const mapping = shuffle([0, 1, 2, 3]); // a permutation: number i+1 → colour mapping[i]
  const prompt = 1 + Math.floor(Math.random() * 4);
  const revealAt = now + PREVIEW_MS;
  return {
    n,
    final,
    pool: [...pool],
    mapping,
    prompt,
    startAt: now,
    revealAt,
    deadlineAt: revealAt + ANSWER_MS,
    resolved: false,
    resultUntil: null,
    answers: {},
    points: {},
  };
}

/** Score the round in place: rank correct taps by arrival → 3 / 2 / 1 / … */
function resolveRound(s: MatchColoursState, now: number): void {
  const r = s.round;
  if (r.resolved) return;
  const correctColour = r.mapping[r.prompt - 1];
  const correct = r.pool
    .filter((id) => r.answers[id]?.colour === correctColour)
    .sort((a, b) => r.answers[a].at - r.answers[b].at);

  const points: Record<number, number> = {};
  for (const id of r.pool) points[id] = 0;
  correct.forEach((id, i) => {
    points[id] = i === 0 ? 3 : i === 1 ? 2 : 1;
  });
  r.points = points;
  for (const id of r.pool) s.scores[id] = (s.scores[id] ?? 0) + points[id];
  r.resolved = true;
  r.resultUntil = now + RESULT_MS;
}

/** The id(s) with the highest cumulative score among `ids`. */
function topScorers(s: MatchColoursState, ids: number[]): number[] {
  const best = Math.max(...ids.map((id) => s.scores[id] ?? 0));
  return ids.filter((id) => (s.scores[id] ?? 0) === best);
}

/** Move past the result pause: next round, a sudden-death final, or game over. */
function advance(s: MatchColoursState, now: number): void {
  const r = s.round;
  if (!r.final) {
    if (r.n < s.roundsTotal) {
      s.round = makeRound(s.order, false, r.n + 1, now);
      return;
    }
    // Last regular round done — break a top-of-table tie with a final round.
    const finalists = topScorers(s, s.order);
    if (finalists.length <= 1) {
      s.winner = finalists[0] ?? null;
      return;
    }
    s.round = makeRound(finalists, true, 1, now);
    return;
  }
  // A final round just resolved — was the tie broken (by THIS round's points)?
  const best = Math.max(...r.pool.map((id) => r.points[id] ?? 0));
  const stillTied = r.pool.filter((id) => (r.points[id] ?? 0) === best);
  if (stillTied.length <= 1) {
    s.winner = stillTied[0] ?? r.pool[0];
    return;
  }
  if (r.n >= MAX_FINAL_ROUNDS) {
    // Nobody is breaking the tie (abandoned game) — settle it deterministically.
    s.winner = [...stillTied].sort((a, b) => a - b)[0];
    return;
  }
  s.round = makeRound(stillTied, true, r.n + 1, now);
}

export const matchcolours: GameEngine<MatchColoursState> = {
  init(players: PlayerRef[], mode: GameMode): MatchColoursState {
    const order = players.map((p) => p.id);
    const scores: Record<number, number> = {};
    for (const id of order) scores[id] = 0;
    return {
      kind: "matchcolours",
      mode,
      order,
      scores,
      roundsTotal: ROUNDS,
      round: makeRound(order, false, 1, Date.now()),
      winner: null,
    };
  },

  move(state, playerId, raw): MatchColoursState {
    const now = Date.now();
    const m = raw as MatchColoursMove;
    if (state.winner != null) throw new Error("The game is over.");
    const r = state.round;
    if (!r.pool.includes(playerId)) throw new Error("You're sitting out this round.");
    if (m.type !== "tap") throw new Error("Unknown move.");
    if (typeof m.colour !== "number" || m.colour < 0 || m.colour > 3) throw new Error("Pick a colour.");
    if (now < r.revealAt) throw new Error("Wait for the number!");
    if (r.resolved || now >= r.deadlineAt) throw new Error("Too late — the round is over.");
    if (r.answers[playerId]) throw new Error("You already played this round.");

    const s: MatchColoursState = structuredClone(state);
    s.round.answers[playerId] = { colour: m.colour, at: now };
    if (s.round.pool.every((id) => s.round.answers[id])) resolveRound(s, now);
    return s;
  },

  /** Resolve an expired window and advance past the result pause. */
  tick(state, now): MatchColoursState | null {
    let s: MatchColoursState | null = null;
    const draft = () => (s ??= structuredClone(state));
    // Each transition pushes the next deadline into the future, so with a single
    // `now` this loop fires at most one transition before settling.
    for (let guard = 0; guard < 64; guard++) {
      const cur = s ?? state;
      if (cur.winner != null) break;
      const r = cur.round;
      if (!r.resolved) {
        if (now >= r.deadlineAt) {
          resolveRound(draft(), now);
          continue;
        }
        break;
      }
      if (r.resultUntil != null && now >= r.resultUntil) {
        advance(draft(), now);
        continue;
      }
      break;
    }
    return s;
  },

  isOver(state): boolean {
    return state.winner != null;
  },

  winners(state): number[] {
    if (state.winner == null) return [];
    const rest = state.order
      .filter((id) => id !== state.winner)
      .sort((a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0));
    return [state.winner, ...rest];
  },

  view(state, viewerId): unknown {
    const r = state.round;
    return {
      kind: "matchcolours",
      colours: COLOURS,
      round: r.n,
      roundsTotal: state.roundsTotal,
      final: r.final,
      pool: r.pool,
      mapping: r.mapping,
      prompt: r.prompt,
      startAt: r.startAt,
      revealAt: r.revealAt,
      deadlineAt: r.deadlineAt,
      resolved: r.resolved,
      resultUntil: r.resultUntil,
      correctColour: r.resolved ? r.mapping[r.prompt - 1] : null,
      scores: state.scores,
      points: r.resolved ? r.points : null,
      yourPoints: r.resolved ? (r.points[viewerId] ?? 0) : null,
      answered: Object.fromEntries(r.pool.map((id) => [id, r.answers[id] != null])),
      yourAnswer: r.answers[viewerId]?.colour ?? null,
      inRound: r.pool.includes(viewerId),
      serverNow: Date.now(),
      winner: state.winner,
      // The board has no turn banner, but these keep the client's view union flat.
      turnPlayerId: -1,
      yourTurn: false,
    };
  },

  scoreFor(state, playerId): number {
    if (!this.isOver(state)) return 0;
    return placeScore(this.winners(state).indexOf(playerId), state.order.length);
  },

  currentPlayer(state): number {
    // The next participant we're still waiting on (for the shared absent-skip).
    return state.round.pool.find((id) => !state.round.answers[id]) ?? state.order[0];
  },

  skipTurn(state, playerId): MatchColoursState {
    // Record a no-answer (-1, never correct) for someone who left, so the round
    // can resolve without them. The deadline tick usually beats this to it.
    const r = state.round;
    if (state.winner != null || !r.pool.includes(playerId) || r.answers[playerId]) return state;
    const s: MatchColoursState = structuredClone(state);
    s.round.answers[playerId] = { colour: -1, at: Date.now() };
    if (s.round.pool.every((id) => s.round.answers[id])) resolveRound(s, Date.now());
    return s;
  },
};
