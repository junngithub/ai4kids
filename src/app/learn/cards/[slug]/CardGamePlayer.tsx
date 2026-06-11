"use client";

/**
 * Client for the three card games. One component drives every phase — menu,
 * lobby, in-play board and results — and every mode (solo / co-op / versus).
 *
 * The server is authoritative: each action POSTs to /api/learn/cards/* and the
 * returned, viewer-redacted state replaces ours. A ~1.2s `sync` poll keeps
 * teammates in step (same poll-based approach as the escape rooms). The board
 * to render is chosen from `state.game.kind`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { modeLabel, type CardGameMeta, type CardGameMode } from "@/lib/card-games/meta";
import type { CardStateDTO } from "@/lib/card-session";

/* ---- View shapes (mirror each engine's view()) ---- */
type MemoryView = {
  kind: "memory";
  cards: { id: number; face: "word" | "emoji"; label: string | null; matched: boolean; flipped: boolean; matchedBy: number | null }[];
  turnPlayerId: number;
  yourTurn: boolean;
  mismatch: boolean;
  scores: Record<number, number>;
  flips: number;
  pairsTotal: number;
  pairsFound: number;
};
type DiscardView = {
  kind: "discard";
  piles: number[];
  yourHand: number[];
  hands: Record<number, number>;
  turnPlayerId: number;
  yourTurn: boolean;
  finished: number[];
  canPlay: boolean;
};
type MathView = {
  kind: "math";
  target: number;
  discardTop: number;
  drawCount: number;
  yourHand: number[];
  hands: Record<number, number>;
  turnPlayerId: number;
  yourTurn: boolean;
  finished: number[];
};
type GameView = MemoryView | DiscardView | MathView;

async function post(path: string, body: unknown): Promise<{ code?: string; state: CardStateDTO }> {
  const r = await fetch(`/api/learn/cards/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export function CardGamePlayer({ game }: { game: CardGameMeta }) {
  const [state, setState] = useState<CardStateDTO | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusRef = useRef<string>("");
  statusRef.current = state?.status ?? "";

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const createGame = (mode: CardGameMode) =>
    run(async () => {
      const data = await post("create", { gameSlug: game.slug, mode });
      setCode(data.code ?? null);
      setState(data.state);
    });

  const joinGame = (raw: string) =>
    run(async () => {
      const data = await post("join", { code: raw.trim().toUpperCase(), gameSlug: game.slug });
      setCode(data.code ?? null);
      setState(data.state);
    });

  const startGame = () =>
    run(async () => {
      if (!code) return;
      const data = await post("start", { code });
      setState(data.state);
    });

  const sendMove = useCallback(
    (move: unknown) =>
      run(async () => {
        if (!code) return;
        const data = await post("move", { code, move });
        setState(data.state);
      }),
    [code, run],
  );

  const leave = () => {
    setCode(null);
    setState(null);
    setError(null);
  };

  // Poll for shared state until the game is done.
  useEffect(() => {
    if (!code) return;
    let stop = false;
    let inflight = false;
    const tick = async () => {
      if (stop || inflight || statusRef.current === "done") return;
      inflight = true;
      try {
        const data = await post("sync", { code });
        if (!stop) setState(data.state);
      } catch {
        /* transient — keep polling */
      } finally {
        inflight = false;
      }
    };
    const id = setInterval(tick, 1200);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [code]);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-fun text-sm font-600">
        <Link href="/learn" className="text-slate-400 hover:text-coral">← Back to activities</Link>
        <span aria-hidden className="text-slate-300">·</span>
        <Link href="/learn/cards" className="text-slate-400 hover:text-coral">🕹️ Brain Arcade</Link>
      </div>

      {/* Title */}
      <div className={`mt-3 flex items-center gap-4 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ${game.ring}`}>
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl ${game.accent}`}>
          {game.emoji}
        </div>
        <div className="min-w-0">
          <h1 className="font-fun text-2xl font-700 text-slate-900">{game.title}</h1>
          <p className="font-round text-slate-500">{game.tagline}</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 font-round text-sm text-coral ring-1 ring-coral/20">
          {error}
        </div>
      )}

      {!state || !code ? (
        <Menu game={game} busy={busy} onSolo={() => createGame("solo")} onHost={createGame} onJoin={joinGame} />
      ) : state.status === "lobby" ? (
        <Lobby game={game} state={state} code={code} busy={busy} onStart={startGame} onLeave={leave} />
      ) : state.status === "done" ? (
        <Results state={state} onAgain={leave} />
      ) : (
        <Board state={state} busy={busy} onMove={sendMove} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Menu — pick a mode or join a friend's game                          */
/* ------------------------------------------------------------------ */
function Menu({
  game,
  busy,
  onSolo,
  onHost,
  onJoin,
}: {
  game: CardGameMeta;
  busy: boolean;
  onSolo: () => void;
  onHost: (mode: CardGameMode) => void;
  onJoin: (code: string) => void;
}) {
  const [joinCode, setJoinCode] = useState("");
  const multiModes = game.modes.filter((m) => m !== "solo") as CardGameMode[];

  return (
    <div className="mt-5 grid gap-5 md:grid-cols-2">
      {/* How to play */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h2 className="font-fun text-lg font-700 text-slate-800">How to play</h2>
        <ul className="mt-3 space-y-2">
          {game.how.map((line, i) => (
            <li key={i} className="flex gap-2 font-round text-sm text-slate-600">
              <span className="text-coral">{i + 1}.</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Choices */}
      <div className="flex flex-col gap-4">
        {game.modes.includes("solo") && (
          <button
            onClick={onSolo}
            disabled={busy}
            className="rounded-3xl bg-grape px-5 py-4 text-left font-fun font-700 text-white shadow transition hover:scale-[1.02] disabled:opacity-50"
          >
            🎯 Play Solo
            <span className="block font-round text-sm font-500 text-white/80">
              Beat the clock on your own.
            </span>
          </button>
        )}

        {multiModes.length > 0 && (
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="font-fun font-700 text-slate-800">Play with friends</div>
            <p className="font-round text-xs text-slate-400">Up to {game.maxPlayers} players, on their own devices.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {multiModes.map((m) => (
                <button
                  key={m}
                  onClick={() => onHost(m)}
                  disabled={busy}
                  className="rounded-full bg-coral px-4 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
                >
                  Host {modeLabel(m)}
                </button>
              ))}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="font-fun text-sm font-700 text-slate-700">Got a code?</div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (joinCode.trim()) onJoin(joinCode);
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="LION42"
                  maxLength={12}
                  className="w-32 rounded-full border-2 border-slate-200 px-4 py-2 font-mono font-700 uppercase tracking-wider text-slate-700 outline-none focus:border-sky"
                />
                <button
                  type="submit"
                  disabled={busy || !joinCode.trim()}
                  className="rounded-full bg-sky px-4 py-2 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lobby — share the code, wait for players, host starts               */
/* ------------------------------------------------------------------ */
function Lobby({
  game,
  state,
  code,
  busy,
  onStart,
  onLeave,
}: {
  game: CardGameMeta;
  state: CardStateDTO;
  code: string;
  busy: boolean;
  onStart: () => void;
  onLeave: () => void;
}) {
  const youHost = state.hostId === state.you;
  const count = state.players.length;
  const enough = count >= game.minPlayers;
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 text-center">
      <div className="font-fun text-sm font-600 text-slate-400">Share this code with your friends</div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-sky/10 px-6 py-3 font-mono text-3xl font-700 tracking-widest text-sky-700 ring-1 ring-sky/20 transition hover:bg-sky/15"
        title="Tap to copy"
      >
        {code} <span className="text-base">{copied ? "✓" : "📋"}</span>
      </button>
      <div className="mt-1 font-round text-xs text-slate-400">{modeLabel(state.mode)} · {game.title}</div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {state.players.map((p) => (
          <span
            key={p.learnerId}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 font-fun text-sm font-700 text-slate-700 ring-1 ring-slate-100"
          >
            {p.avatar ?? "🙂"} {p.name}{p.learnerId === state.you ? " (you)" : ""}
            {p.isHost && <span className="text-amber-500" title="Host">★</span>}
          </span>
        ))}
      </div>

      <div className="mt-6">
        {youHost ? (
          <button
            onClick={onStart}
            disabled={busy || !enough}
            className="rounded-full bg-coral px-8 py-3 font-fun text-lg font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
          >
            {enough ? "Start game ▶" : `Need ${game.minPlayers}+ players`}
          </button>
        ) : (
          <div className="font-round text-slate-500">Waiting for the host to start… 🕒</div>
        )}
        <div>
          <button onClick={onLeave} className="mt-3 font-fun text-sm font-600 text-slate-400 hover:text-coral">
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */
function Results({ state, onAgain }: { state: CardStateDTO; onAgain: () => void }) {
  const nameById = new Map(state.players.map((p) => [p.learnerId, p.name]));
  const youWon = state.winners[0] === state.you;
  const solo = state.mode === "solo";
  const coop = state.mode === "coop";

  return (
    <div className="mt-5 rounded-3xl bg-gradient-to-br from-sunny/30 to-coral/20 p-8 text-center shadow-sm ring-1 ring-amber-100">
      <div className="text-6xl">{youWon || coop || solo ? "🏆" : "🎉"}</div>
      <h2 className="mt-2 font-fun text-2xl font-700 text-slate-900">
        {solo
          ? "You did it!"
          : coop
            ? "You cleared it together!"
            : youWon
              ? "You win! 🎉"
              : `${nameById.get(state.winners[0]) ?? "Someone"} wins!`}
      </h2>

      {!solo && !coop && (
        <ol className="mx-auto mt-5 max-w-xs space-y-2 text-left">
          {state.winners.map((id, i) => (
            <li
              key={id}
              className={`flex items-center justify-between rounded-2xl px-4 py-2 font-fun font-700 ${
                i === 0 ? "bg-white text-amber-600 shadow-sm" : "bg-white/60 text-slate-600"
              }`}
            >
              <span>{["🥇", "🥈", "🥉"][i] ?? "🎖️"} {nameById.get(id) ?? "Player"}{id === state.you ? " (you)" : ""}</span>
            </li>
          ))}
        </ol>
      )}

      <button
        onClick={onAgain}
        className="mt-6 rounded-full bg-coral px-8 py-3 font-fun text-lg font-700 text-white shadow transition hover:scale-105"
      >
        Play again ▶
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Board dispatcher + turn banner                                      */
/* ------------------------------------------------------------------ */
function Board({ state, busy, onMove }: { state: CardStateDTO; busy: boolean; onMove: (m: unknown) => void }) {
  const game = state.game as GameView;
  const nameById = new Map(state.players.map((p) => [p.learnerId, p.name]));
  const turnName = game.yourTurn ? "Your turn" : `${nameById.get(game.turnPlayerId) ?? "…"}'s turn`;

  return (
    <div className="mt-5">
      {state.mode !== "solo" && (
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-2.5 font-fun font-700 ring-1 ${
            game.yourTurn ? "bg-mint/15 text-emerald-700 ring-mint/30" : "bg-slate-50 text-slate-500 ring-slate-100"
          }`}
        >
          <span>{game.yourTurn ? "🟢 " : "🕒 "}{turnName}</span>
          <span className="flex flex-wrap gap-1.5 font-round text-xs">
            {state.players.map((p) => (
              <span
                key={p.learnerId}
                className={`rounded-full px-2 py-0.5 ${
                  p.learnerId === game.turnPlayerId ? "bg-white text-slate-700 shadow-sm ring-1 ring-slate-200" : "text-slate-400"
                }`}
              >
                {p.avatar ?? "🙂"} {p.name}
              </span>
            ))}
          </span>
        </div>
      )}

      {game.kind === "memory" && <MemoryBoard view={game} busy={busy} onMove={onMove} />}
      {game.kind === "discard" && <DiscardBoard view={game} busy={busy} onMove={onMove} />}
      {game.kind === "math" && <MathBoard view={game} busy={busy} onMove={onMove} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Memory board                                                        */
/* ------------------------------------------------------------------ */
function MemoryBoard({ view, busy, onMove }: { view: MemoryView; busy: boolean; onMove: (m: unknown) => void }) {
  // After a mismatch, the current player auto-flips the cards back.
  useEffect(() => {
    if (!view.mismatch || !view.yourTurn) return;
    const t = setTimeout(() => onMove({ type: "next" }), 1100);
    return () => clearTimeout(t);
  }, [view.mismatch, view.yourTurn, onMove]);

  const lock = busy || view.mismatch; // don't accept flips mid-resolve
  const flippedCount = view.cards.filter((c) => c.flipped).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between font-fun text-sm font-700 text-slate-500">
        <span>Pairs found: {view.pairsFound}/{view.pairsTotal}</span>
      </div>
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
        {view.cards.map((c) => {
          const up = c.flipped || c.matched;
          const disabled = lock || up || !view.yourTurn || flippedCount >= 2;
          return (
            <button
              key={c.id}
              onClick={() => onMove({ type: "flip", cardId: c.id })}
              disabled={disabled}
              className={`flex aspect-[3/4] items-center justify-center rounded-2xl text-center font-fun font-700 shadow-sm transition ${
                c.matched
                  ? "bg-mint/20 text-emerald-700 ring-1 ring-mint/40"
                  : up
                    ? "scale-[1.03] bg-white text-slate-800 ring-2 ring-sky/40"
                    : "bg-gradient-to-br from-grape to-bubble text-white hover:scale-[1.02]"
              } ${disabled && !up && !c.matched ? "" : ""}`}
            >
              {up ? (
                <span className={c.face === "emoji" ? "text-3xl sm:text-4xl" : "px-1 text-base sm:text-lg"}>
                  {c.label}
                </span>
              ) : (
                <span className="text-2xl text-white/70">★</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Discard (Tower Tumble) board                                        */
/* ------------------------------------------------------------------ */
function DiscardBoard({ view, busy, onMove }: { view: DiscardView; busy: boolean; onMove: (m: unknown) => void }) {
  const [selected, setSelected] = useState<number | null>(null);

  const legalPile = (pileTop: number, card: number) => card === 10 || card > pileTop;
  const canPlayCardOnPile = (pileIdx: number) =>
    selected != null && view.yourTurn && !busy && legalPile(view.piles[pileIdx], selected);

  return (
    <div>
      {/* Piles */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
        {view.piles.map((top, i) => {
          const active = canPlayCardOnPile(i);
          return (
            <button
              key={i}
              onClick={() => {
                if (active && selected != null) {
                  onMove({ type: "play", pile: i, card: selected });
                  setSelected(null);
                }
              }}
              disabled={!active}
              className={`flex aspect-[3/4] flex-col items-center justify-center rounded-2xl text-center shadow-sm transition ${
                top === 0
                  ? "bg-slate-50 text-slate-300 ring-1 ring-dashed ring-slate-200"
                  : "bg-white text-slate-800 ring-1 ring-slate-200"
              } ${active ? "scale-[1.03] ring-2 ring-mint/60" : ""}`}
            >
              <span className="font-fun text-3xl font-700">{top === 0 ? "—" : top}</span>
              <span className="mt-1 font-round text-[10px] text-slate-400">pile {i + 1}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center font-round text-xs text-slate-400">
        {selected != null ? "Tap a glowing pile to play your card." : "Pick a card, then a pile. Play a 10 to clear a pile."}
      </p>

      {/* Hand */}
      <Hand cards={view.yourHand} selected={selected != null ? [selected] : []} onToggle={(c) => setSelected((s) => (s === c ? null : c))} disabled={!view.yourTurn || busy} />

      {/* Actions */}
      <div className="mt-3 flex justify-center">
        <button
          onClick={() => onMove({ type: "pass" })}
          disabled={view.canPlay || !view.yourTurn || busy}
          className="rounded-full bg-slate-100 px-6 py-2.5 font-fun font-700 text-slate-500 transition hover:bg-slate-200 disabled:opacity-40"
          title={view.canPlay ? "You still have a move!" : "No move — pass your turn"}
        >
          Pass 🤷
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Math (Number Hunt) board                                            */
/* ------------------------------------------------------------------ */
function makesTarget(cards: number[], target: number): boolean {
  if (cards.length === 1) return cards[0] === target;
  if (cards.length === 2) return cards[0] + cards[1] === target || Math.abs(cards[0] - cards[1]) === target;
  return false;
}

function MathBoard({ view, busy, onMove }: { view: MathView; busy: boolean; onMove: (m: unknown) => void }) {
  const [picked, setPicked] = useState<number[]>([]);

  // Picks are tracked by hand INDEX so two cards of the same value both work.
  // Drop any indices that no longer point at a card (after a move/poll).
  useEffect(() => {
    setPicked((p) => p.filter((idx) => view.yourHand[idx] != null).slice(0, 2));
  }, [view.yourHand]);

  const toggle = (idx: number) => {
    setPicked((p) => {
      if (p.includes(idx)) return p.filter((k) => k !== idx);
      if (p.length >= 2) return p;
      return [...p, idx];
    });
  };
  const pickedValues = picked.map((idx) => view.yourHand[idx]).filter((v) => v != null);
  const readyVals = makesTarget(pickedValues, view.target);

  return (
    <div>
      {/* Target + piles */}
      <div className="flex items-center justify-center gap-4">
        <div className="rounded-3xl bg-sky/10 px-6 py-4 text-center ring-1 ring-sky/20">
          <div className="font-round text-xs text-slate-400">make</div>
          <div className="font-fun text-5xl font-700 text-sky-700">{view.target}</div>
        </div>
        <div className="flex gap-3">
          <div className="flex aspect-[3/4] w-16 flex-col items-center justify-center rounded-2xl bg-white text-slate-800 shadow-sm ring-1 ring-slate-200">
            <span className="font-fun text-2xl font-700">{view.discardTop}</span>
            <span className="font-round text-[9px] text-slate-400">discard</span>
          </div>
          <div className="flex aspect-[3/4] w-16 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-grape to-bubble text-white shadow-sm">
            <span className="font-fun text-2xl font-700">{view.drawCount}</span>
            <span className="font-round text-[9px] text-white/70">draw</span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center font-round text-xs text-slate-400">
        Discard one card that equals {view.target}, or two that add or subtract to {view.target}.
      </p>

      {/* Hand (pick by index so duplicates work) */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {view.yourHand.map((card, idx) => {
          const on = picked.includes(idx);
          return (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              disabled={!view.yourTurn || busy}
              className={`flex aspect-[3/4] w-14 items-center justify-center rounded-2xl font-fun text-2xl font-700 shadow-sm transition disabled:opacity-50 ${
                on ? "scale-[1.06] bg-sky text-white ring-2 ring-sky/60" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:scale-[1.03]"
              }`}
            >
              {card}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-center gap-3">
        <button
          onClick={() => {
            if (readyVals) {
              onMove({ type: "discard", cards: pickedValues });
              setPicked([]);
            }
          }}
          disabled={!readyVals || !view.yourTurn || busy}
          className="rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-40"
        >
          Discard ✓
        </button>
        <button
          onClick={() => {
            onMove({ type: "draw" });
            setPicked([]);
          }}
          disabled={!view.yourTurn || busy}
          className="rounded-full bg-slate-100 px-6 py-2.5 font-fun font-700 text-slate-600 transition hover:bg-slate-200 disabled:opacity-40"
        >
          Draw 🃏
        </button>
      </div>
      {picked.length > 0 && !readyVals && (
        <p className="mt-2 text-center font-round text-xs text-coral">
          {pickedValues.join(" & ")} doesn&apos;t make {view.target} yet.
        </p>
      )}
    </div>
  );
}

/* ---- Shared hand strip (discard game) ---- */
function Hand({
  cards,
  selected,
  onToggle,
  disabled,
}: {
  cards: number[];
  selected: number[];
  onToggle: (card: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {cards.map((card, idx) => {
        const on = selected.includes(card);
        return (
          <button
            key={idx}
            onClick={() => onToggle(card)}
            disabled={disabled}
            className={`flex aspect-[3/4] w-12 items-center justify-center rounded-xl font-fun text-xl font-700 shadow-sm transition disabled:opacity-50 ${
              on ? "scale-[1.08] bg-coral text-white ring-2 ring-coral/60" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:scale-[1.04]"
            }`}
          >
            {card}
          </button>
        );
      })}
    </div>
  );
}
