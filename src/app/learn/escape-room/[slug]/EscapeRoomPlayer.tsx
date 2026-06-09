"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  generateWordGrid,
  type EscapeRoom,
  type EscapeRoomPuzzle,
  type Station,
} from "@/lib/escape-rooms";
import type { SessionStateDTO, PlayerDTO } from "@/lib/escape-session";

const POINTS_FIRST_TRY = 10;
const POINTS_WITH_HELP = 6;
const WALK_MS = 600;
const POLL_MS = 1300;

/** Where the character idles (x/y as % of the scene), bottom-left of the room. */
const IDLE_POS = { x: 10, y: 78 };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

type Mode = null | "solo" | "coop";

export function EscapeRoomPlayer({ room }: { room: EscapeRoom }) {
  const [mode, setMode] = useState<Mode>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
        ← Back to activities
      </Link>

      {/* Room header */}
      <div className={`mt-3 flex items-center gap-4 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ${room.ring}`}>
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl ${room.accent}`}>
          {room.emoji}
        </div>
        <div className="min-w-0">
          <h1 className="font-fun text-2xl font-700 text-slate-900">{room.title}</h1>
          <p className="truncate font-round text-sm text-slate-500">{room.tagline}</p>
        </div>
      </div>

      {mode === null && <ModeSelect room={room} onPick={setMode} />}
      {mode === "solo" && <SoloRoom room={room} />}
      {mode === "coop" && <CoopRoom room={room} onLeave={() => setMode(null)} />}
    </div>
  );
}

/** Entry screen: read the story, then play solo or with friends. */
function ModeSelect({ room, onPick }: { room: EscapeRoom; onPick: (m: Mode) => void }) {
  return (
    <div className="mt-4 rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-amber-100">
      <div className="text-6xl">{room.character}</div>
      <p className="mx-auto mt-4 max-w-md font-round text-slate-600">{room.intro}</p>
      <p className="mt-3 font-fun text-sm font-600 text-slate-400">
        {room.stations.length} objects to solve · ages {room.ageRange}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => onPick("solo")}
          className="rounded-full bg-coral px-8 py-3 font-fun text-lg font-700 text-white shadow-lg transition hover:scale-105"
        >
          Play solo ▶
        </button>
        <button
          onClick={() => onPick("coop")}
          className="rounded-full bg-grape px-8 py-3 font-fun text-lg font-700 text-white shadow-lg transition hover:scale-105"
        >
          Play with friends 👫
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Solo                                                                */
/* ------------------------------------------------------------------ */

function SoloRoom({ room }: { room: EscapeRoom }) {
  const total = room.stations.length;
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [points, setPoints] = useState(0);
  const [escaped, setEscaped] = useState(false);
  const [savedScore, setSavedScore] = useState<number | null>(null);

  function onSolve(id: string, firstTry: boolean) {
    setSolvedIds((s) => (s.includes(id) ? s : [...s, id]));
    setPoints((p) => p + (firstTry ? POINTS_FIRST_TRY : POINTS_WITH_HELP));
  }

  useEffect(() => {
    if (!escaped) return;
    const score = Math.round((points / (total * POINTS_FIRST_TRY)) * 100);
    let cancelled = false;
    fetch("/api/learn/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activitySlug: room.activitySlug, score, metadata: { room: room.slug, stations: total } }),
    })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSavedScore(score);
      });
    return () => {
      cancelled = true;
    };
  }, [escaped, points, total, room.activitySlug, room.slug]);

  if (escaped) {
    return (
      <EscapedCard
        room={room}
        score={savedScore}
        onReplay={() => {
          setSolvedIds([]);
          setPoints(0);
          setSavedScore(null);
          setEscaped(false);
        }}
      />
    );
  }

  return <RoomScene room={room} solvedIds={solvedIds} onSolve={onSolve} onEscape={() => setEscaped(true)} />;
}

/* ------------------------------------------------------------------ */
/* Co-op (multiplayer)                                                 */
/* ------------------------------------------------------------------ */

async function api<T = { state: SessionStateDTO }>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong");
  return data as T;
}

function CoopRoom({ room, onLeave }: { room: EscapeRoom; onLeave: () => void }) {
  const [stage, setStage] = useState<"choose" | "session">("choose");
  const [code, setCode] = useState<string | null>(null);
  const [st, setSt] = useState<SessionStateDTO | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const atStationRef = useRef<string | null>(null);

  async function host() {
    setBusy(true);
    setErr(null);
    try {
      const d = await api<{ code: string; state: SessionStateDTO }>("/api/learn/escape/create", { roomSlug: room.slug });
      setCode(d.code);
      setSt(d.state);
      setStage("session");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!joinCode.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const d = await api<{ code: string; state: SessionStateDTO }>("/api/learn/escape/join", { code: joinCode.trim() });
      setCode(d.code);
      setSt(d.state);
      setStage("session");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    if (!code) return;
    try {
      const d = await api("/api/learn/escape/start", { code });
      setSt(d.state);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  // Poll loop: heartbeat + presence + shared state. Stops once escaped.
  useEffect(() => {
    if (stage !== "session" || !code) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (stopped) return;
      try {
        const d = await api("/api/learn/escape/sync", { code, atStation: atStationRef.current });
        if (!stopped) {
          setSt(d.state);
          if (d.state.status === "escaped") {
            stopped = true;
            return;
          }
        }
      } catch {
        /* transient — keep polling */
      }
      if (!stopped) timer = setTimeout(loop, POLL_MS);
    };
    loop();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [stage, code]);

  async function onSolve(stationId: string, firstTry: boolean) {
    setSt((s) => (s ? { ...s, solved: s.solved.includes(stationId) ? s.solved : [...s.solved, stationId] } : s));
    try {
      const d = await api("/api/learn/escape/solve", { code, stationId, firstTry });
      setSt(d.state);
    } catch {
      /* the poll will reconcile */
    }
  }

  async function onEscape() {
    try {
      const d = await api("/api/learn/escape/finish", { code });
      setSt(d.state);
    } catch {
      /* ignore */
    }
  }

  function onPresence(atStation: string | null) {
    atStationRef.current = atStation;
    if (!code) return;
    api("/api/learn/escape/sync", { code, atStation })
      .then((d) => setSt(d.state))
      .catch(() => {});
  }

  // --- Choose: host or join ---
  if (stage === "choose") {
    return (
      <div className="mt-4 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-amber-100">
        <h2 className="text-center font-fun text-2xl font-700 text-slate-900">Play with friends 👫</h2>
        <p className="mt-1 text-center font-round text-slate-500">
          Start a new room and share the code, or type a friend&apos;s code to join.
        </p>
        {err && <p className="mt-3 text-center font-fun text-sm font-700 text-coral">{err}</p>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            onClick={host}
            disabled={busy}
            className="flex flex-col items-center gap-2 rounded-3xl bg-grape/10 p-6 ring-1 ring-grape/30 transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
          >
            <span className="text-4xl">🚪</span>
            <span className="font-fun text-lg font-700 text-grape">Start a room</span>
            <span className="font-round text-xs text-slate-500">Get a code to share</span>
          </button>
          <div className="flex flex-col items-center gap-2 rounded-3xl bg-sky/10 p-6 ring-1 ring-sky/30">
            <span className="text-4xl">🔑</span>
            <span className="font-fun text-lg font-700 text-sky-600">Join a room</span>
            <div className="mt-1 flex w-full gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && join()}
                placeholder="CODE"
                aria-label="Room code"
                maxLength={12}
                className="w-full rounded-full border-2 border-sky-200 px-4 py-2 text-center font-fun text-lg font-700 uppercase tracking-widest text-slate-800 outline-none focus:border-sky-400"
              />
              <button
                onClick={join}
                disabled={busy || !joinCode.trim()}
                className="rounded-full bg-sky-500 px-4 py-2 font-fun font-700 text-white shadow disabled:opacity-50"
              >
                Go
              </button>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center">
          <button onClick={onLeave} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
            ← Play on my own instead
          </button>
        </div>
      </div>
    );
  }

  if (!st) {
    return <div className="mt-4 text-center font-fun text-slate-500">Loading the room… 🚪</div>;
  }

  // --- Lobby: waiting for the host to start ---
  if (st.status === "lobby") {
    const isHost = st.you === st.hostId;
    return (
      <div className="mt-4 rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-amber-100">
        <p className="font-fun text-sm font-600 text-slate-400">Room code — share it with your friends!</p>
        <div className="mt-2 inline-block rounded-2xl bg-slate-900 px-8 py-3 font-mono text-4xl font-700 tracking-[0.3em] text-mint">
          {st.code}
        </div>
        <PlayerStrip players={st.players} youId={st.you} />
        <div className="mt-6">
          {isHost ? (
            <button
              onClick={startGame}
              className="rounded-full bg-coral px-8 py-3 font-fun text-lg font-700 text-white shadow-lg transition hover:scale-105"
            >
              Start the escape! 🚀
            </button>
          ) : (
            <p className="font-round text-slate-500">Waiting for the host to start… ⏳</p>
          )}
        </div>
        <div className="mt-5">
          <button onClick={onLeave} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
            ← Leave room
          </button>
        </div>
      </div>
    );
  }

  // --- Escaped: team result ---
  if (st.status === "escaped") {
    const score = st.total ? Math.round((st.points / (st.total * POINTS_FIRST_TRY)) * 100) : 0;
    return (
      <div className="mt-4 rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-amber-100">
        <div className="text-7xl">🎉</div>
        <h2 className="mt-3 font-fun text-3xl font-700 text-slate-900">Your team escaped!</h2>
        <p className="mx-auto mt-2 max-w-md font-round text-slate-500">{room.outro}</p>
        <div className="mt-4 inline-block rounded-full bg-mint/20 px-5 py-1.5 font-fun font-700 text-emerald-600">
          +{score} points each!
        </div>
        <PlayerStrip players={st.players} youId={st.you} />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={onLeave} className="rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow">
            Back to start 🔁
          </button>
          <Link href="/learn" className="rounded-full bg-slate-100 px-6 py-3 font-fun font-600 text-slate-600">
            All activities
          </Link>
        </div>
      </div>
    );
  }

  // --- Playing: the shared room scene ---
  return (
    <RoomScene
      room={room}
      solvedIds={st.solved}
      onSolve={onSolve}
      onEscape={onEscape}
      others={st.players.filter((p) => p.learnerId !== st.you)}
      onPresence={onPresence}
    />
  );
}

/** A horizontal row of player avatars (lobby + results). */
function PlayerStrip({ players, youId }: { players: PlayerDTO[]; youId: number }) {
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-3">
      {players.map((p) => (
        <div
          key={p.learnerId}
          className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 ring-1 ring-amber-100"
        >
          <span className="text-2xl">{p.avatar || "🙂"}</span>
          <span className="font-fun text-sm font-700 text-slate-700">
            {p.learnerId === youId ? "You" : p.name.split(" ")[0]}
            {p.isHost && " 👑"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared room scene (used by both solo and co-op)                     */
/* ------------------------------------------------------------------ */

type ScenePlayer = Pick<PlayerDTO, "learnerId" | "name" | "avatar" | "atStation">;

function RoomScene({
  room,
  solvedIds,
  onSolve,
  onEscape,
  others = [],
  onPresence,
}: {
  room: EscapeRoom;
  solvedIds: string[];
  onSolve: (stationId: string, firstTry: boolean) => void;
  onEscape: () => void;
  others?: ScenePlayer[];
  onPresence?: (atStation: string | null) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [walkingTo, setWalkingTo] = useState<string | null>(null);
  const [charPos, setCharPos] = useState(IDLE_POS);
  const [facingLeft, setFacingLeft] = useState(false);
  const [doorMsg, setDoorMsg] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [justSolved, setJustSolved] = useState(false);

  const total = room.stations.length;
  const allSolved = solvedIds.length >= total;
  const openStation = room.stations.find((s) => s.id === openId) ?? null;
  // Already solved (by me earlier, or by a teammate) → show a read-only recap.
  const reviewing = !!openStation && solvedIds.includes(openStation.id) && !justSolved;
  const lockPuzzle = justSolved || reviewing;

  // Stations that hand a digit to the exit keypad, in scene order → the code.
  const exitStations = useMemo(
    () =>
      room.stations
        .map((s) => {
          const clue = (s.provides ?? []).find((c) => c.kind === "exitDigit");
          return clue && clue.kind === "exitDigit" ? { station: s, digit: clue.value } : null;
        })
        .filter((x): x is { station: Station; digit: string } => x !== null),
    [room.stations],
  );
  const usesCodeExit = exitStations.length > 0;
  const exitCode = exitStations.map((d) => d.digit).join("");

  // For the open word-search station: which target words are still hidden
  // because the machine that lights them up isn't solved yet, plus the picture
  // (emoji) clue to show in place of each revealed word. The grid stays fully
  // tappable the whole time — it's chained, never locked out.
  const norm = (w: string) => w.toUpperCase().replace(/[^A-Z]/g, "");
  const { hiddenWords, wordHints } = useMemo(() => {
    const hidden = new Set<string>();
    const hints = new Map<string, string>();
    if (openStation?.puzzle.kind !== "wordsearch") return { hiddenWords: hidden, wordHints: hints };
    const providerOf = new Map<string, { id: string; emoji: string }>();
    for (const s of room.stations) {
      for (const clue of s.provides ?? []) {
        if (clue.kind === "word" && clue.to === openStation.id) {
          providerOf.set(norm(clue.word), { id: s.id, emoji: clue.emoji });
        }
      }
    }
    for (const w of openStation.puzzle.words) {
      const provider = providerOf.get(norm(w));
      if (!provider) continue;
      hints.set(norm(w), provider.emoji);
      if (!solvedIds.includes(provider.id)) hidden.add(norm(w));
    }
    return { hiddenWords: hidden, wordHints: hints };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openStation, room.stations, solvedIds]);

  useEffect(() => {
    setWrongCount(0);
    setHintShown(false);
    setJustSolved(false);
  }, [openId]);

  function walkTo(x: number, y: number) {
    setFacingLeft(x < charPos.x);
    setCharPos({ x: clamp(x, 4, 92), y: clamp(y, 20, 82) });
  }

  function visit(station: Station) {
    // Solved stations stay clickable so you can walk back and review the puzzle
    // (and re-check the number it gave you for the door).
    if (openId || walkingTo) return;
    setWalkingTo(station.id);
    walkTo(station.x, station.y + 14);
    onPresence?.(station.id);
    window.setTimeout(() => {
      setOpenId(station.id);
      setWalkingTo(null);
    }, WALK_MS);
  }

  function closeModal() {
    setOpenId(null);
    onPresence?.(null);
  }

  function handleSolved() {
    if (justSolved || !openStation) return;
    setJustSolved(true);
    onSolve(openStation.id, wrongCount === 0 && !hintShown);
  }

  function tryDoor() {
    if (openId || walkingTo || doorOpen) return;
    if (!allSolved) {
      setDoorMsg(true);
      window.setTimeout(() => setDoorMsg(false), 1800);
      return;
    }
    setWalkingTo("__door__");
    walkTo(82, 70);
    window.setTimeout(() => {
      setWalkingTo(null);
      // Code-exit rooms: key in the code you collected. Otherwise, just leave.
      if (usesCodeExit) setDoorOpen(true);
      else onEscape();
    }, WALK_MS + 150);
  }

  return (
    <>
      <div className={`relative mt-4 h-[460px] overflow-hidden rounded-[2rem] shadow-sm ring-1 ${room.ring} sm:h-[520px]`}>
        <SceneBackdrop room={room} />

        {/* Hint / progress banner */}
        <div className="absolute inset-x-0 top-0 flex justify-center p-3">
          <div className="rounded-full bg-white/85 px-4 py-1.5 font-fun text-xs font-700 text-slate-600 shadow-sm backdrop-blur">
            {allSolved
              ? usesCodeExit
                ? "🔢 All solved — open the door and key in the code!"
                : "🔓 All done — head to the door!"
              : `Tap an object to solve its puzzle 🔍  ·  ${solvedIds.length}/${total}`}
          </div>
        </div>

        {/* Stations */}
        {room.stations.map((s) => {
          const done = solvedIds.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => visit(s)}
              disabled={!!openId || !!walkingTo}
              aria-label={`${s.label}${done ? " (solved — tap to review)" : ""}`}
              className="group absolute -translate-x-1/2 -translate-y-1/2 disabled:cursor-default"
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            >
              <span
                className={`flex h-16 w-16 items-center justify-center rounded-2xl text-4xl shadow-md ring-2 transition ${
                  done
                    ? "bg-mint/40 ring-emerald-300"
                    : "bg-white/90 ring-white/70 group-hover:scale-110 group-hover:ring-coral/50"
                }`}
              >
                {done ? "✅" : s.emoji}
              </span>
              {!done && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 animate-ping rounded-full bg-coral/60" aria-hidden />
              )}
              <span className="mt-1 block whitespace-nowrap rounded-full bg-white/80 px-2 py-0.5 text-center font-fun text-[11px] font-700 text-slate-600 shadow-sm">
                {s.label}
              </span>
            </button>
          );
        })}

        {/* Exit door */}
        <button
          onClick={tryDoor}
          disabled={!!openId || !!walkingTo}
          aria-label={allSolved ? "Open the exit door" : "Exit door (locked)"}
          className="absolute bottom-[26%] right-[5%] -translate-y-1/2 text-center disabled:cursor-default"
        >
          <span
            className={`relative flex h-20 w-16 items-center justify-center rounded-t-2xl text-5xl shadow-md ring-2 transition ${
              allSolved ? "bg-amber-100 ring-amber-300 hover:scale-105" : "bg-slate-200/90 ring-slate-300"
            }`}
          >
            🚪
            <span className="absolute -bottom-2 -right-2 text-2xl">
              {allSolved ? (usesCodeExit ? "🔢" : "🔓") : "🔒"}
            </span>
          </span>
          <span className="mt-1 block font-fun text-[11px] font-700 text-slate-700">Exit</span>
        </button>

        {doorMsg && (
          <div className="absolute bottom-[44%] right-[3%] rounded-2xl bg-coral px-3 py-1.5 font-fun text-xs font-700 text-white shadow-lg">
            Solve every object first! 🔒
          </div>
        )}

        {/* Other players (co-op) */}
        {others.map((p, i) => {
          const pos = otherPos(room, p.atStation, i);
          return (
            <div
              key={p.learnerId}
              className="pointer-events-none absolute z-[9] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all ease-in-out"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transitionDuration: `${WALK_MS}ms` }}
            >
              <span className="text-4xl opacity-90 drop-shadow-md sm:text-5xl">{p.avatar || "🙂"}</span>
              <span className="-mt-1 rounded-full bg-white/80 px-2 py-0.5 font-fun text-[10px] font-700 text-slate-600 shadow-sm">
                {p.name.split(" ")[0]}
              </span>
            </div>
          );
        })}

        {/* Character — "me", moves diagonally to its target. */}
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 text-5xl transition-all ease-in-out sm:text-6xl"
          style={{ left: `${charPos.x}%`, top: `${charPos.y}%`, transitionDuration: `${WALK_MS}ms` }}
        >
          <span
            className="inline-block drop-shadow-lg transition-transform"
            style={{ transform: `scaleX(${facingLeft ? -1 : 1}) rotate(${walkingTo ? "-6deg" : "0deg"})` }}
          >
            {room.character}
          </span>
          <span
            className={`mx-auto mt-0.5 block h-1.5 w-8 rounded-full bg-slate-900/20 blur-[2px] transition-opacity ${
              walkingTo ? "opacity-40" : "opacity-70"
            }`}
            aria-hidden
          />
        </div>
      </div>

      <p className="mt-3 text-center font-round text-sm text-slate-400">
        {others.length > 0
          ? "Solve the objects together — anything a teammate unlocks unlocks for everyone!"
          : "Walk up to each object and solve its puzzle, then open the exit door to escape."}
      </p>

      {/* Puzzle modal */}
      {openStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Close puzzle"
            onClick={closeModal}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-amber-100">
            <div className="flex items-center gap-2 font-fun font-700 text-slate-700">
              <span className="text-2xl">{openStation.emoji}</span> {openStation.label}
              <button
                onClick={closeModal}
                aria-label="Close"
                className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {reviewing ? (
              <div className="mt-4">
                <div className="rounded-2xl bg-sky/10 py-2 text-center font-fun text-sm font-700 text-sky-700 ring-1 ring-sky/20">
                  ✅ Already solved — here&apos;s a recap.
                </div>
                <PuzzleReview puzzle={openStation.puzzle} wordHints={wordHints} />
                <div className="mt-4 rounded-2xl bg-mint/15 p-4 text-center ring-1 ring-mint/30">
                  <p className="font-round text-sm text-slate-600">{openStation.puzzle.learn}</p>
                </div>
                <div className="mt-4 text-center">
                  <button
                    onClick={closeModal}
                    className="rounded-full bg-coral px-7 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105"
                  >
                    Got it 👍
                  </button>
                </div>
              </div>
            ) : (
              <>
                <PuzzleView
                  key={openStation.id}
                  puzzle={openStation.puzzle}
                  solved={lockPuzzle}
                  hiddenWords={hiddenWords}
                  wordHints={wordHints}
                  onSolved={handleSolved}
                  onWrong={() => setWrongCount((c) => c + 1)}
                />

                {!justSolved && (
                  <div className="mt-5 text-center">
                    {hintShown ? (
                      <p className="font-round text-sm text-amber-600">💡 {openStation.puzzle.hint}</p>
                    ) : (
                      <button
                        onClick={() => setHintShown(true)}
                        className="font-fun text-sm font-600 text-slate-400 underline-offset-2 hover:text-amber-600 hover:underline"
                      >
                        Need a hint? 💡
                      </button>
                    )}
                    {wrongCount > 0 && (
                      <p className="mt-2 font-fun text-sm font-600 text-coral">Not quite — give it another go! 🔁</p>
                    )}
                  </div>
                )}

                {justSolved && (
                  <div className="mt-6 rounded-2xl bg-mint/15 p-5 text-center ring-1 ring-mint/30">
                    <div className="font-fun text-lg font-700 text-emerald-700">🔓 Solved!</div>
                    <p className="mt-1 font-round text-sm text-slate-600">{openStation.puzzle.learn}</p>
                    <button
                      onClick={closeModal}
                      className="mt-4 rounded-full bg-coral px-7 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105"
                    >
                      {allSolved ? "Back to the room 🚪" : "Keep exploring 🔍"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Exit keypad — type the code you collected from the machines */}
      {doorOpen && (
        <ExitKeypad
          stations={exitStations}
          code={exitCode}
          outro={room.outro}
          onClose={() => setDoorOpen(false)}
          onEscape={onEscape}
        />
      )}
    </>
  );
}

/** Where to draw another player: near the object they're at, else idling. */
function otherPos(room: EscapeRoom, atStation: string | null, idx: number) {
  const st = room.stations.find((s) => s.id === atStation);
  if (st) return { x: clamp(st.x + (idx % 2 ? 8 : -8), 4, 92), y: clamp(st.y + 17, 20, 82) };
  return { x: clamp(20 + ((idx * 15) % 60), 4, 92), y: 80 };
}

/** Shared "you escaped" card for solo play. */
function EscapedCard({
  room,
  score,
  onReplay,
}: {
  room: EscapeRoom;
  score: number | null;
  onReplay: () => void;
}) {
  return (
    <div className="mt-4 rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-amber-100">
      <div className="text-7xl">🎉</div>
      <h2 className="mt-3 font-fun text-3xl font-700 text-slate-900">You escaped!</h2>
      <p className="mx-auto mt-2 max-w-md font-round text-slate-500">{room.outro}</p>
      {score != null && (
        <div className="mt-4 inline-block rounded-full bg-mint/20 px-5 py-1.5 font-fun font-700 text-emerald-600">
          +{score} points!
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={onReplay} className="rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow">
          Play again 🔁
        </button>
        <Link href="/learn" className="rounded-full bg-slate-100 px-6 py-3 font-fun font-600 text-slate-600">
          All activities
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scenery + puzzles (unchanged)                                       */
/* ------------------------------------------------------------------ */

/** Painted-in scenery for a room: textured wall, themed floor, and mood decor. */
function SceneBackdrop({ room }: { room: EscapeRoom }) {
  return (
    <>
      <div className={`absolute inset-0 bg-gradient-to-b ${room.wall}`} />
      <div className="absolute inset-0" style={wallPattern(room.pattern)} />

      {room.decor.map((d, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ left: `${d.x}%`, top: `${d.y}%`, fontSize: `${d.size ?? 2.5}rem`, opacity: d.opacity ?? 1 }}
        >
          <span
            className="inline-block drop-shadow-sm"
            style={{
              animation: d.spin
                ? "er-spin 9s linear infinite"
                : d.float
                  ? "er-float 4s ease-in-out infinite"
                  : undefined,
            }}
          >
            {d.emoji}
          </span>
        </span>
      ))}

      <div className={`absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b ${room.floor}`}>
        <div className="absolute inset-0" style={floorPattern(room.floorKind)} />
        <div className="absolute inset-x-0 top-0 h-0.5 bg-white/30" />
      </div>
    </>
  );
}

function wallPattern(kind: EscapeRoom["pattern"]): React.CSSProperties {
  switch (kind) {
    case "circuit":
      return {
        backgroundImage:
          "linear-gradient(rgba(125,211,252,.10) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(125,211,252,.10) 1px, transparent 1px)," +
          "radial-gradient(rgba(125,211,252,.5) 1.5px, transparent 2px)",
        backgroundSize: "34px 34px, 34px 34px, 34px 34px",
      };
    case "dots":
      return {
        backgroundImage: "radial-gradient(rgba(255,255,255,.5) 2px, transparent 2.5px)",
        backgroundSize: "24px 24px",
      };
    case "leaves":
      return {
        backgroundImage:
          "radial-gradient(circle at 30% 30%, rgba(16,185,129,.12) 6px, transparent 7px)," +
          "radial-gradient(circle at 70% 60%, rgba(16,185,129,.09) 8px, transparent 9px)",
        backgroundSize: "70px 70px, 96px 96px",
      };
    default:
      return {};
  }
}

function floorPattern(kind: EscapeRoom["floorKind"]): React.CSSProperties {
  switch (kind) {
    case "metal":
      return {
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(255,255,255,.10) 0 1px, transparent 1px 56px)," +
          "repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, transparent 1px 22px)",
      };
    case "wood":
      return {
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(0,0,0,.18) 0 2px, transparent 2px 48px)," +
          "repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)",
      };
    case "tile":
      return {
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)",
        backgroundSize: "38px 38px, 38px 38px",
      };
    default:
      return {};
  }
}

/** Renders the active puzzle and reports solved / wrong attempts to the parent. */
function PuzzleView({
  puzzle,
  solved,
  hiddenWords,
  wordHints,
  onSolved,
  onWrong,
}: {
  puzzle: EscapeRoomPuzzle;
  solved: boolean;
  /** Word-search targets not yet lit up by another machine (shown as ❓). */
  hiddenWords?: Set<string>;
  /** Picture (emoji) clue to show for each revealed word instead of its text. */
  wordHints?: Map<string, string>;
  onSolved: () => void;
  onWrong: () => void;
}) {
  if (puzzle.kind === "mcq") return <McqPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "code") return <CodePuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "wordsearch")
    return (
      <WordSearchPuzzle
        puzzle={puzzle}
        solved={solved}
        hiddenWords={hiddenWords}
        wordHints={wordHints}
        onSolved={onSolved}
        onWrong={onWrong}
      />
    );
  return <OrderPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
}

type PuzzleProps<T> = {
  puzzle: T;
  solved: boolean;
  onSolved: () => void;
  onWrong: () => void;
};

function McqPuzzle({ puzzle, solved, onSolved, onWrong }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "mcq" }>>) {
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);

  function pick(i: number) {
    if (solved) return;
    if (i === puzzle.answerIndex) onSolved();
    else if (!wrongPicks.includes(i)) {
      setWrongPicks((w) => [...w, i]);
      onWrong();
    }
  }

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>
      <div className="mt-4 grid gap-3">
        {puzzle.options.map((opt, i) => {
          const isAnswer = i === puzzle.answerIndex;
          const isWrong = wrongPicks.includes(i);
          const cls =
            solved && isAnswer
              ? "bg-mint/30 text-emerald-700 ring-emerald-300"
              : isWrong
                ? "bg-coral/15 text-coral/70 ring-coral/30 line-through"
                : "bg-amber-50 text-slate-700 ring-amber-100 hover:bg-amber-100";
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={solved || isWrong}
              className={`rounded-2xl px-5 py-4 font-fun text-base font-700 ring-2 transition disabled:cursor-not-allowed ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CodePuzzle({ puzzle, solved, onSolved, onWrong }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "code" }>>) {
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (solved) return;
    if (value.trim().toLowerCase() === puzzle.answer.trim().toLowerCase()) onSolved();
    else {
      onWrong();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>
      <div className="mt-4 inline-block rounded-2xl bg-slate-900 px-6 py-3 font-mono text-2xl font-700 tracking-widest text-mint">
        {puzzle.clue}
      </div>
      <div className="mt-5 flex justify-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={solved}
          placeholder="Type the code"
          aria-label="Enter the code"
          className={`w-44 rounded-full border-2 px-5 py-2.5 text-center font-fun text-lg font-700 text-slate-800 outline-none transition ${
            shake ? "animate-pulse border-coral" : "border-amber-200 focus:border-coral"
          }`}
        />
        <button
          type="submit"
          disabled={solved || !value.trim()}
          className="rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
        >
          Unlock 🔑
        </button>
      </div>
    </form>
  );
}

function OrderPuzzle({ puzzle, solved, onSolved, onWrong }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "order" }>>) {
  const shuffled = useMemo(() => {
    const arr = puzzle.items.map((label, originalIndex) => ({ label, originalIndex }));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [puzzle.items]);

  const [placed, setPlaced] = useState<number[]>([]);
  const [wrongTap, setWrongTap] = useState<number | null>(null);

  function tap(originalIndex: number) {
    if (solved || placed.includes(originalIndex)) return;
    if (originalIndex === placed.length) {
      const next = [...placed, originalIndex];
      setPlaced(next);
      setWrongTap(null);
      if (next.length === puzzle.items.length) onSolved();
    } else {
      onWrong();
      setWrongTap(originalIndex);
      setTimeout(() => setWrongTap((w) => (w === originalIndex ? null : w)), 500);
    }
  }

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>
      <div className="mt-4 grid gap-2.5">
        {shuffled.map(({ label, originalIndex }) => {
          const order = placed.indexOf(originalIndex);
          const isPlaced = order !== -1;
          const isWrong = wrongTap === originalIndex;
          const cls = isPlaced
            ? "bg-mint/25 text-emerald-700 ring-emerald-300"
            : isWrong
              ? "bg-coral/15 text-coral ring-coral/40"
              : "bg-amber-50 text-slate-700 ring-amber-100 hover:bg-amber-100";
          return (
            <button
              key={originalIndex}
              onClick={() => tap(originalIndex)}
              disabled={solved || isPlaced}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left font-fun font-600 ring-2 transition disabled:cursor-default ${cls}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 font-700 text-slate-500">
                {isPlaced ? order + 1 : "·"}
              </span>
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 font-round text-xs text-slate-400">Tap them in the right order.</p>
    </div>
  );
}

function WordSearchPuzzle({
  puzzle,
  solved,
  hiddenWords,
  wordHints,
  onSolved,
  onWrong,
}: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "wordsearch" }>> & {
  hiddenWords?: Set<string>;
  wordHints?: Map<string, string>;
}) {
  const grid = useMemo(() => generateWordGrid(puzzle.words, puzzle.size), [puzzle.words, puzzle.size]);
  const targets = useMemo(() => puzzle.words.map((w) => w.toUpperCase().replace(/[^A-Z]/g, "")), [puzzle.words]);
  const hidden = hiddenWords ?? new Set<string>();
  const anyHidden = targets.some((t) => hidden.has(t));

  const [first, setFirst] = useState<[number, number] | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [badCells, setBadCells] = useState<Set<string>>(new Set());

  function lineCells(a: [number, number], b: [number, number]): [number, number][] | null {
    const [r1, c1] = a;
    const [r2, c2] = b;
    const straight = r1 === r2 || c1 === c2 || Math.abs(r2 - r1) === Math.abs(c2 - c1);
    if (!straight) return null;
    const len = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    const cells: [number, number][] = [];
    for (let i = 0; i < len; i++) cells.push([r1 + dr * i, c1 + dc * i]);
    return cells;
  }

  function clickCell(r: number, c: number) {
    if (solved) return;
    if (!first) {
      setFirst([r, c]);
      return;
    }
    const cells = lineCells(first, [r, c]);
    setFirst(null);
    if (!cells) return;
    const word = cells.map(([rr, cc]) => grid[rr][cc]).join("");
    const rev = word.split("").reverse().join("");
    // A word only counts once another machine has lit up its picture clue.
    const hit = targets.find((t) => (t === word || t === rev) && !found.includes(t) && !hidden.has(t));
    if (hit) {
      const nextFound = [...found, hit];
      setFound(nextFound);
      setFoundCells((prev) => {
        const s = new Set(prev);
        cells.forEach(([rr, cc]) => s.add(`${rr},${cc}`));
        return s;
      });
      if (nextFound.length === targets.length) onSolved();
    } else {
      onWrong();
      const s = new Set(cells.map(([rr, cc]) => `${rr},${cc}`));
      setBadCells(s);
      setTimeout(() => setBadCells(new Set()), 450);
    }
  }

  return (
    <div className="mt-4 text-center">
      <p className="font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {targets.map((t) => {
          const got = found.includes(t);
          const isHidden = hidden.has(t);
          const emoji = wordHints?.get(t);
          // Hidden → "?", revealed-with-a-picture → show only the emoji (never
          // the spelled-out word), otherwise (plain rooms) → show the word.
          const label = isHidden ? "❓ ? ?" : got ? "✅" : emoji ?? t;
          return (
            <span
              key={t}
              className={`rounded-full px-3 py-1 font-fun text-base font-700 ring-1 ${
                isHidden
                  ? "bg-slate-100 text-slate-400 ring-slate-200"
                  : got
                    ? "bg-mint/30 text-emerald-700 ring-emerald-300"
                    : "bg-amber-50 text-slate-600 ring-amber-100"
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex justify-center">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${grid.length}, minmax(0, 1fr))` }}>
          {grid.map((row, r) =>
            row.map((ch, c) => {
              const key = `${r},${c}`;
              const isFound = foundCells.has(key);
              const isBad = badCells.has(key);
              const isFirst = first && first[0] === r && first[1] === c;
              const cls = isFound
                ? "bg-mint/40 text-emerald-700 ring-emerald-300"
                : isBad
                  ? "bg-coral/20 text-coral ring-coral/40"
                  : isFirst
                    ? "bg-sky/30 text-sky-700 ring-sky-400"
                    : "bg-amber-50 text-slate-700 ring-amber-100 hover:bg-amber-100";
              return (
                <button
                  key={key}
                  onClick={() => clickCell(r, c)}
                  disabled={solved}
                  className={`flex h-8 w-8 items-center justify-center rounded-md font-mono text-sm font-700 ring-1 transition disabled:cursor-default sm:h-9 sm:w-9 ${cls}`}
                >
                  {ch}
                </button>
              );
            }),
          )}
        </div>
      </div>
      <p className="mt-3 font-round text-xs text-slate-400">
        {anyHidden
          ? "Each ❓ becomes a picture once you solve the machine that knows it — then find that word."
          : "Tap the first letter, then the last letter of a word."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only recap shown when re-opening an already-solved station     */
/* ------------------------------------------------------------------ */

/** Static "here's the solution" view, so a player can review what they did. */
function PuzzleReview({
  puzzle,
  wordHints,
}: {
  puzzle: EscapeRoomPuzzle;
  wordHints?: Map<string, string>;
}) {
  const norm = (w: string) => w.toUpperCase().replace(/[^A-Z]/g, "");

  if (puzzle.kind === "mcq") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 rounded-2xl bg-mint/20 px-4 py-3 font-fun font-700 text-emerald-700 ring-1 ring-emerald-300">
          ✅ {puzzle.options[puzzle.answerIndex]}
        </div>
      </div>
    );
  }

  if (puzzle.kind === "code") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 flex flex-col items-center gap-2">
          <span className="rounded-xl bg-slate-900 px-4 py-1.5 font-mono text-lg font-700 tracking-widest text-mint">
            {puzzle.clue}
          </span>
          <span className="rounded-2xl bg-mint/20 px-4 py-1.5 font-fun font-700 text-emerald-700 ring-1 ring-emerald-300">
            ✅ {puzzle.answer}
          </span>
        </div>
      </div>
    );
  }

  if (puzzle.kind === "order") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 grid gap-2 text-left">
          {puzzle.items.map((it, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl bg-mint/15 px-4 py-2.5 font-fun font-600 text-slate-700 ring-1 ring-emerald-200"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white font-700 text-emerald-600">
                {i + 1}
              </span>
              {it}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // wordsearch — show the picture clue + the word it stood for.
  return (
    <div className="mt-3 text-center">
      <p className="font-fun font-700 text-slate-800">{puzzle.prompt}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {puzzle.words.map((w) => {
          const emoji = wordHints?.get(norm(w));
          return (
            <span
              key={w}
              className="rounded-full bg-mint/20 px-3 py-1 font-fun text-sm font-700 text-emerald-700 ring-1 ring-emerald-300"
            >
              {emoji ? `${emoji} ` : "✅ "}
              {norm(w)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exit keypad — type the code collected from the machines            */
/* ------------------------------------------------------------------ */

/**
 * The door's number lock. Each box belongs to one machine (shown by its emoji)
 * and the player types in the digit that machine revealed — they enter the code
 * themselves rather than having it auto-filled.
 */
function ExitKeypad({
  stations,
  code,
  outro,
  onClose,
  onEscape,
}: {
  stations: { station: Station; digit: string }[];
  code: string;
  outro: string;
  onClose: () => void;
  onEscape: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(() => stations.map(() => ""));
  const [shake, setShake] = useState(false);
  const [ok, setOk] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(i: number, raw: string) {
    const d = raw.replace(/[^0-9]/g, "").slice(-1);
    setDigits((arr) => {
      const next = [...arr];
      next[i] = d;
      return next;
    });
    if (d && i < stations.length - 1) refs.current[i + 1]?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ok) return;
    if (digits.join("") === code) {
      setOk(true);
      window.setTimeout(onEscape, 800);
    } else {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close keypad"
        onClick={() => !ok && onClose()}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-2xl ring-1 ring-amber-100">
        <div className="text-5xl">🔢</div>
        <h3 className="mt-2 font-fun text-2xl font-700 text-slate-900">Door Keypad</h3>

        {ok ? (
          <div className="mt-5 rounded-2xl bg-mint/15 p-5 ring-1 ring-mint/30">
            <div className="font-fun text-lg font-700 text-emerald-700">🎉 Click! The door unlocks!</div>
            <p className="mt-1 font-round text-sm text-slate-600">{outro}</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="mx-auto mt-1 max-w-xs font-round text-sm text-slate-500">
              Each machine showed you a number. Type them in to open the door!
            </p>
            <div className="mt-5 flex justify-center gap-3">
              {stations.map((s, i) => (
                <div key={s.station.id} className="flex flex-col items-center gap-1">
                  <span className="text-2xl" aria-hidden>
                    {s.station.emoji}
                  </span>
                  <input
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    value={digits[i]}
                    onChange={(e) => setDigit(i, e.target.value)}
                    inputMode="numeric"
                    aria-label={`Number from ${s.station.label}`}
                    className={`h-16 w-14 rounded-2xl border-2 text-center font-mono text-3xl font-700 text-slate-800 outline-none transition ${
                      shake ? "animate-pulse border-coral" : "border-amber-200 focus:border-coral"
                    }`}
                  />
                </div>
              ))}
            </div>
            {shake && (
              <p className="mt-3 font-fun text-sm font-600 text-coral">
                That code didn&apos;t work — pop back and check each machine&apos;s number! 🔁
              </p>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-slate-100 px-5 py-2.5 font-fun font-600 text-slate-600 transition hover:bg-slate-200"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={digits.some((d) => !d)}
                className="rounded-full bg-coral px-7 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
              >
                Open door 🔓
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
