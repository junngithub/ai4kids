"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  generateWordGrid,
  type Dir,
  type EscapeRoom,
  type EscapeRoomPuzzle,
  type RoomCipherExit,
  type RoomUnscrambleExit,
  type SceneKind,
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
  // Suit-console progress, lifted here so unscrambled cores stay solved even if
  // the player closes the console and walks away (the keypad itself unmounts).
  const [coresDone, setCoresDone] = useState<number[]>([]);
  const [wrongCount, setWrongCount] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [justSolved, setJustSolved] = useState(false);

  const total = room.stations.length;
  const allSolved = solvedIds.length >= total;
  const openStation = room.stations.find((s) => s.id === openId) ?? null;
  // Already solved (by me earlier, or by a teammate) → show a read-only recap.
  const reviewing = !!openStation && solvedIds.includes(openStation.id) && !justSolved;
  const lockPuzzle = justSolved || reviewing;

  // Exit code: the 1-indexed Column & Row where the word-search words all
  // cross. The player reads it off the labelled grid and keys it into the door.
  const codeSlots = useMemo(() => {
    for (const s of room.stations) {
      if (s.puzzle.kind === "wordsearch" && s.puzzle.intersection) {
        const [row, col] = s.puzzle.intersection;
        return [
          { label: "Column", emoji: "➡️", value: String(col + 1) },
          { label: "Row", emoji: "⬇️", value: String(row + 1) },
        ];
      }
    }
    return [];
  }, [room.stations]);
  const usesCodeExit = codeSlots.length > 0;
  const exitCode = codeSlots.map((d) => d.value).join("");

  // Special doors: a console that fills in as you solve stations and opens any
  // time (the escape itself stays gated on completing the puzzle inside).
  const cipherExit = room.exit?.kind === "cipher" ? room.exit : null;
  const unscrambleExit = room.exit?.kind === "unscramble" ? room.exit : null;
  const specialExit = !!room.exit;

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
    // Special door: the console is viewable any time (it fills in as you solve
    // the stations); the input only unlocks once every piece is in.
    if (specialExit) {
      setWalkingTo("__door__");
      walkTo(82, 70);
      window.setTimeout(() => {
        setWalkingTo(null);
        setDoorOpen(true);
      }, WALK_MS + 150);
      return;
    }
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
                ? "🔢 All solved — open the door and key in the crossing's Column & Row!"
                : cipherExit
                  ? "🔣 All powered up — open the door and crack the decoder code!"
                  : unscrambleExit
                    ? "🦸 All cores charged — open the suit and unscramble the words!"
                    : "🔓 All done — head to the door!"
              : cipherExit
                ? `🔌 Fix the machines to power the door's decoder  ·  ${solvedIds.length}/${total}`
                : unscrambleExit
                  ? `⚡ Charge the hero cores to power the suit  ·  ${solvedIds.length}/${total}`
                  : `Tap an object to solve its puzzle 🔍  ·  ${solvedIds.length}/${total}`}
          </div>
        </div>

        {/* Stations — each rendered as an object standing in the room, themed to
            the scene (holder + stand + ground shadow) so it reads as part of it. */}
        {room.stations.map((s) => {
          const done = solvedIds.includes(s.id);
          const th = STATION_THEME[room.scene];
          return (
            <button
              key={s.id}
              onClick={() => visit(s)}
              disabled={!!openId || !!walkingTo}
              aria-label={`${s.label}${done ? " (solved — tap to review)" : ""}`}
              className="group absolute -translate-x-1/2 -translate-y-1/2 disabled:cursor-default"
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            >
              <span className="relative flex flex-col items-center">
                {/* themed glow halo (behind the holder via DOM order, no z-index) */}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute -top-2 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full blur-md transition group-hover:opacity-90 ${
                    done ? "bg-emerald-300/25" : `${th.glow} opacity-70`
                  }`}
                />
                {/* device holder */}
                <span className="relative">
                  <span
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl text-4xl shadow-lg ring-2 backdrop-blur-sm transition ${
                      done ? "bg-mint/50 ring-emerald-300" : `${th.holder} ${th.ring} group-hover:scale-110`
                    }`}
                  >
                    {done ? "✅" : s.emoji}
                  </span>
                  {!done && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 animate-ping rounded-full bg-coral/60" aria-hidden />
                  )}
                </span>
                {/* stand connecting the object to the ground */}
                <span aria-hidden className={`-mt-0.5 h-2.5 w-3.5 rounded-b-[3px] ${done ? "bg-emerald-400/50" : th.stand}`} />
                {/* soft ground shadow */}
                <span aria-hidden className="-mt-0.5 h-1.5 w-11 rounded-[50%] bg-black/25 blur-[2px]" />
                {/* label */}
                <span className="mt-0.5 block whitespace-nowrap rounded-full bg-white/85 px-2 py-0.5 text-center font-fun text-[11px] font-700 text-slate-600 shadow-sm">
                  {s.label}
                </span>
              </span>
            </button>
          );
        })}

        {/* Exit — a transparent hit-area over the carved doorway niche (the
            visual door is the SVG alcove behind it; no emoji door slab). */}
        <button
          onClick={tryDoor}
          disabled={!!openId || !!walkingTo}
          aria-label={allSolved ? "Open the exit door" : specialExit ? "Open the door console" : "Exit door (locked)"}
          className="absolute bottom-[23%] right-[6%] h-24 w-16 disabled:cursor-default"
        >
          {/* label on the floor under the threshold */}
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/80 px-2 py-0.5 font-fun text-[11px] font-700 text-slate-700 shadow-sm">
            Exit
          </span>
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
                  showCoords
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

      {/* Exit keypad — type the crossing's Column & Row */}
      {doorOpen && usesCodeExit && (
        <ExitKeypad
          slots={codeSlots}
          code={exitCode}
          outro={room.outro}
          onClose={() => setDoorOpen(false)}
          onEscape={onEscape}
        />
      )}

      {/* Door decoder — decrypt the cipher the machines powered up */}
      {doorOpen && cipherExit && (
        <CipherExitKeypad
          exit={cipherExit}
          solvedIds={solvedIds}
          outro={room.outro}
          onClose={() => setDoorOpen(false)}
          onEscape={onEscape}
        />
      )}

      {/* Suit console — unscramble the words each core unlocked */}
      {doorOpen && unscrambleExit && (
        <UnscrambleExitKeypad
          exit={unscrambleExit}
          solvedIds={solvedIds}
          outro={room.outro}
          done={coresDone}
          onWordSolved={(i) =>
            setCoresDone((d) => (d.includes(i) ? d : [...d, i]))
          }
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

      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <SceneArt scene={room.scene} />
        <Doorway scene={room.scene} />
      </svg>

      <div className={`absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b ${room.floor}`}>
        <div className="absolute inset-0" style={floorPattern(room.floorKind)} />
        <div className="absolute inset-x-0 top-0 h-0.5 bg-white/30" />
      </div>
    </>
  );
}

/**
 * Hand-drawn vector scenery for each room — layered silhouettes, no emojis.
 * Drawn in a 0–100 box stretched to fill; the floor strip overlays y≈75–100,
 * so scenery sits with its base around y≈74.
 */
function SceneArt({ scene }: { scene: SceneKind }) {
  switch (scene) {
    case "lab":
      return (
        <>
          <defs>
            <radialGradient id="lab-planet" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#4c1d95" />
            </radialGradient>
          </defs>
          {/* space viewport */}
          <rect x="5" y="11" width="34" height="40" rx="4" fill="#0b1220" stroke="#38bdf8" strokeOpacity="0.5" strokeWidth="0.7" />
          <circle cx="22" cy="29" r="8" fill="url(#lab-planet)" />
          <ellipse cx="22" cy="29" rx="13" ry="3.4" fill="none" stroke="#7dd3fc" strokeOpacity="0.6" strokeWidth="0.8" />
          {[[10, 17], [33, 19], [14, 44], [30, 42], [19, 15], [27, 22]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.7" fill="#e0f2fe" opacity="0.85" />
          ))}
          {/* gear rings */}
          <circle cx="52" cy="20" r="7" fill="none" stroke="#38bdf8" strokeOpacity="0.22" strokeWidth="2.5" strokeDasharray="2 2.6" />
          <circle cx="61" cy="33" r="4.5" fill="none" stroke="#7dd3fc" strokeOpacity="0.2" strokeWidth="2" strokeDasharray="1.6 2" />
          {/* conduit */}
          <line x1="39" y1="60" x2="70" y2="60" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="0.8" />
          {[44, 52, 60, 68].map((x) => (
            <circle key={x} cx={x} cy="60" r="1.1" fill="#38bdf8" opacity="0.55" />
          ))}
          {/* server racks */}
          {[[70, 16], [83, 24], [92, 20]].map(([x, y], r) => (
            <g key={r}>
              <rect x={x} y={y} width="9" height={74 - y} rx="1.5" fill="#111c30" stroke="#1e3a5f" strokeWidth="0.5" />
              {Array.from({ length: Math.floor((74 - y) / 6) }).map((_, k) => (
                <rect key={k} x={x + 1.5} y={y + 3 + k * 6} width="6" height="3" rx="0.6" fill="#0f1828" />
              ))}
              {Array.from({ length: Math.floor((74 - y) / 6) }).map((_, k) => (
                <circle key={`l${k}`} cx={x + 7} cy={y + 4.5 + k * 6} r="0.6" fill={k % 3 === 0 ? "#34d399" : k % 3 === 1 ? "#fbbf24" : "#38bdf8"} />
              ))}
            </g>
          ))}
        </>
      );
    case "hero":
      return (
        <>
          <defs>
            <radialGradient id="hero-moon" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="70%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="20" cy="22" r="16" fill="url(#hero-moon)" opacity="0.7" />
          <circle cx="20" cy="22" r="8" fill="#fef9c3" opacity="0.9" />
          {[[40, 12], [55, 20], [70, 10], [82, 24], [48, 30], [90, 16], [33, 34]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 2 ? 0.9 : 0.6} fill="#fff" opacity="0.8" />
          ))}
          {/* city skyline */}
          {[[0, 50], [10, 42], [20, 55], [30, 46], [40, 58], [50, 40], [60, 52], [70, 44], [80, 56], [90, 48]].map(
            ([x, y], i) => (
              <g key={i}>
                <rect x={x} y={y} width="10" height={74 - y} fill="#4c1d95" opacity="0.75" />
                {Array.from({ length: 3 }).map((_, c) =>
                  Array.from({ length: Math.floor((74 - y) / 8) }).map((_, r) => (
                    <rect key={`${c}-${r}`} x={x + 1.6 + c * 2.6} y={y + 3 + r * 8} width="1.4" height="2.4" fill="#fcd34d" opacity="0.7" />
                  )),
                )}
              </g>
            ),
          )}
          {/* energy bolts */}
          <polyline points="64,8 60,20 66,20 60,34" fill="none" stroke="#a855f7" strokeWidth="1.4" strokeLinejoin="round" opacity="0.8" />
          <polyline points="78,6 75,16 80,16 76,28" fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeLinejoin="round" opacity="0.7" />
        </>
      );
    case "eco":
      return (
        <>
          <defs>
            <radialGradient id="eco-sun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="84" cy="16" r="16" fill="url(#eco-sun)" />
          <circle cx="84" cy="16" r="6.5" fill="#fde047" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4;
            return (
              <line key={i} x1={84 + Math.cos(a) * 9} y1={16 + Math.sin(a) * 9} x2={84 + Math.cos(a) * 12} y2={16 + Math.sin(a) * 12} stroke="#fde047" strokeWidth="0.9" strokeLinecap="round" />
            );
          })}
          {/* hills */}
          <path d="M0 74 Q 30 50 60 66 T 100 60 L100 74 Z" fill="#34d399" opacity="0.55" />
          <path d="M0 74 Q 25 60 55 70 T 100 68 L100 74 Z" fill="#059669" opacity="0.55" />
          {/* wind turbine */}
          <line x1="50" y1="74" x2="50" y2="40" stroke="#e2e8f0" strokeWidth="1.2" />
          <circle cx="50" cy="40" r="1.6" fill="#475569" />
          {[0, 120, 240].map((deg) => (
            <line key={deg} x1="50" y1="40" x2={50 + Math.cos((deg * Math.PI) / 180) * 11} y2={40 + Math.sin((deg * Math.PI) / 180) * 11} stroke="#e2e8f0" strokeWidth="1.8" strokeLinecap="round" />
          ))}
          {/* solar panels */}
          <g opacity="0.9">
            {[6, 19].map((x) => (
              <g key={x}>
                <line x1={x + 5} y1="74" x2={x + 5} y2="66" stroke="#64748b" strokeWidth="1" />
                <polygon points={`${x},64 ${x + 10},60 ${x + 12},66 ${x + 2},70`} fill="#1e3a8a" stroke="#3b82f6" strokeWidth="0.4" />
                <line x1={x + 3.5} y1="62.5" x2={x + 5.5} y2="68" stroke="#3b82f6" strokeWidth="0.4" />
                <line x1={x + 7} y1="61" x2={x + 9} y2="66.5" stroke="#3b82f6" strokeWidth="0.4" />
              </g>
            ))}
          </g>
          {/* recycling tanks */}
          {[[88, 9], [76, 7]].map(([x, w], i) => (
            <g key={i}>
              <rect x={x} y={52} width={w} height="22" rx="3" fill="#0d9488" opacity="0.8" />
              <rect x={x} y={58} width={w} height="2" fill="#5eead4" opacity="0.6" />
              <rect x={x} y={65} width={w} height="2" fill="#5eead4" opacity="0.6" />
            </g>
          ))}
        </>
      );
    case "history":
      return (
        <>
          <defs>
            <radialGradient id="hist-sun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="100%" stopColor="#fed7aa" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="16" r="18" fill="url(#hist-sun)" opacity="0.8" />
          <circle cx="50" cy="16" r="7" fill="#fdba74" opacity="0.85" />
          {/* shophouse row */}
          {[6, 20, 34, 48, 62, 76].map((x, i) => {
            const h = [26, 30, 24, 28, 32, 26][i];
            const top = 66 - h;
            const col = ["#c2410c", "#b45309", "#a16207", "#9a3412", "#92400e", "#b45309"][i];
            return (
              <g key={x} opacity="0.82">
                <polygon points={`${x},${top} ${x + 6},${top - 4} ${x + 12},${top}`} fill={col} />
                <rect x={x} y={top} width="12" height={h} fill={col} />
                {[0, 1].map((r) =>
                  [0, 1].map((c) => (
                    <rect key={`${r}-${c}`} x={x + 2 + c * 5} y={top + 4 + r * 8} width="3" height="5" rx="0.5" fill="#fef3c7" opacity="0.7" />
                  )),
                )}
              </g>
            );
          })}
          {/* river */}
          <rect x="0" y="66" width="100" height="8" fill="#0ea5e9" opacity="0.35" />
          {[8, 28, 48, 68, 88].map((x) => (
            <path key={x} d={`M${x} 70 q 4 -1.5 8 0 t 8 0`} fill="none" stroke="#bae6fd" strokeWidth="0.6" opacity="0.6" />
          ))}
          {/* hanging lanterns */}
          {[88, 94].map((x, i) => (
            <g key={x}>
              <line x1={x} y1="10" x2={x} y2={18 + i * 6} stroke="#7c2d12" strokeWidth="0.4" />
              <rect x={x - 2.2} y={18 + i * 6} width="4.4" height="6" rx="2.2" fill="#ef4444" opacity="0.85" />
              <line x1={x - 2.2} y1={19.5 + i * 6} x2={x + 2.2} y2={19.5 + i * 6} stroke="#fca5a5" strokeWidth="0.4" />
            </g>
          ))}
        </>
      );
    case "festival":
      return (
        <>
          {/* bunting */}
          <path d="M0 8 Q 50 18 100 8" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.5" />
          {Array.from({ length: 12 }).map((_, i) => {
            const x = 4 + i * 8;
            const y = 8 + Math.sin((i / 12) * Math.PI) * 9;
            const col = ["#fb7185", "#fbbf24", "#a78bfa", "#34d399"][i % 4];
            return <polygon key={i} points={`${x - 3},${y} ${x + 3},${y} ${x},${y + 5}`} fill={col} opacity="0.85" />;
          })}
          {/* hanging lanterns */}
          {[14, 30, 50, 70, 86].map((x, i) => (
            <g key={x}>
              <line x1={x} y1={12 + Math.sin((i / 5) * Math.PI) * 6} x2={x} y2={22 + i * 2} stroke="#fff" strokeOpacity="0.3" strokeWidth="0.4" />
              <ellipse cx={x} cy={27 + i * 2} rx="3" ry="3.8" fill={["#f472b6", "#fbbf24", "#a78bfa", "#fb7185", "#fcd34d"][i]} opacity="0.85" />
              <rect x={x - 1} y={23 + i * 2} width="2" height="1.2" fill="#fff" opacity="0.5" />
            </g>
          ))}
          {/* sparkles */}
          {[[40, 16], [60, 22], [78, 14], [24, 24], [92, 28]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y - 2} L${x + 0.7} ${y} L${x + 2} ${y} L${x + 0.7} ${y + 0.7} L${x} ${y + 2} L${x - 0.7} ${y + 0.7} L${x - 2} ${y} L${x - 0.7} ${y} Z`} fill="#fff7ed" opacity="0.8" />
          ))}
          {/* stage with spotlights */}
          <polygon points="20,74 30,40 36,40 30,74" fill="#fde68a" opacity="0.18" />
          <polygon points="80,74 70,40 64,40 70,74" fill="#f9a8d4" opacity="0.18" />
          <rect x="22" y="70" width="56" height="4" rx="1" fill="#7c3aed" opacity="0.4" />
        </>
      );
    case "nature":
      return (
        <>
          <defs>
            <radialGradient id="nat-sun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="100%" stopColor="#fef9c3" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="82" cy="15" r="14" fill="url(#nat-sun)" />
          <circle cx="82" cy="15" r="6" fill="#fde047" opacity="0.85" />
          {/* birds */}
          {[[30, 18], [37, 15], [44, 19]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y} q 2 -2 4 0 q 2 -2 4 0`} fill="none" stroke="#475569" strokeWidth="0.6" opacity="0.6" />
          ))}
          {/* hills */}
          <path d="M0 74 Q 28 54 56 68 T 100 62 L100 74 Z" fill="#86efac" opacity="0.6" />
          <path d="M0 74 Q 32 62 64 71 T 100 68 L100 74 Z" fill="#22c55e" opacity="0.5" />
          {/* supertrees */}
          {[[14, 30], [24, 40], [90, 34]].map(([x, baseY], i) => (
            <g key={i} opacity="0.8">
              <path d={`M${x - 1.4} 74 L${x - 0.7} ${baseY} L${x + 0.7} ${baseY} L${x + 1.4} 74 Z`} fill="#3f6212" />
              <path d={`M${x} ${baseY - 2} Q ${x - 9} ${baseY + 2} ${x - 7} ${baseY + 9} Q ${x} ${baseY + 4} ${x + 7} ${baseY + 9} Q ${x + 9} ${baseY + 2} ${x} ${baseY - 2} Z`} fill="#15803d" />
            </g>
          ))}
          {/* round trees */}
          {[[44, 60], [54, 62], [70, 58]].map(([x, y], i) => (
            <g key={i} opacity="0.8">
              <rect x={x - 0.8} y={y} width="1.6" height={74 - y} fill="#854d0e" />
              <circle cx={x} cy={y - 2} r="5" fill="#16a34a" />
              <circle cx={x - 3} cy={y} r="3.5" fill="#22c55e" />
              <circle cx={x + 3} cy={y} r="3.5" fill="#15803d" />
            </g>
          ))}
          {/* pond */}
          <ellipse cx="60" cy="72" rx="22" ry="3.4" fill="#38bdf8" opacity="0.3" />
        </>
      );
  }
}

/**
 * A recessed doorway niche carved into the back wall on the right, where the
 * HTML exit-door button stands. Drawn behind the door so the exit reads as
 * built into the scene rather than floating on top of it. Coords match the
 * door's footprint (~x82–98, rising from the floor line at y≈75).
 */
/**
 * Per-scene styling for the station objects so they read as themed equipment
 * standing in the room rather than identical white stickers.
 * `holder` = the icon panel, `ring` = its border, `glow` = halo, `stand` = base.
 */
const STATION_THEME: Record<SceneKind, { holder: string; ring: string; glow: string; stand: string }> = {
  lab: { holder: "bg-slate-900/70 text-cyan-50", ring: "ring-cyan-400/60", glow: "bg-cyan-400/40", stand: "bg-cyan-400/50" },
  hero: { holder: "bg-white/85", ring: "ring-grape/50", glow: "bg-fuchsia-400/40", stand: "bg-grape/50" },
  eco: { holder: "bg-white/85", ring: "ring-emerald-400/60", glow: "bg-emerald-400/35", stand: "bg-emerald-600/50" },
  history: { holder: "bg-amber-50/90", ring: "ring-amber-500/60", glow: "bg-amber-400/40", stand: "bg-amber-700/50" },
  festival: { holder: "bg-white/85", ring: "ring-pink-400/60", glow: "bg-pink-400/40", stand: "bg-pink-500/50" },
  nature: { holder: "bg-white/85", ring: "ring-emerald-400/60", glow: "bg-emerald-400/35", stand: "bg-emerald-700/50" },
};

const DOORWAY_COLORS: Record<SceneKind, { recess: string; frame: string }> = {
  lab: { recess: "#0b1220", frame: "#38bdf8" },
  hero: { recess: "#2e1065", frame: "#a855f7" },
  eco: { recess: "#064e3b", frame: "#34d399" },
  history: { recess: "#431407", frame: "#f59e0b" },
  festival: { recess: "#4a044e", frame: "#f472b6" },
  nature: { recess: "#14532d", frame: "#4ade80" },
};

function Doorway({ scene }: { scene: SceneKind }) {
  const { recess, frame } = DOORWAY_COLORS[scene];
  return (
    <g>
      {/* recessed arched niche */}
      <path d="M82 75 L82 60 Q82 51 90 51 Q98 51 98 60 L98 75 Z" fill={recess} opacity="0.92" />
      {/* outer frame */}
      <path d="M82 75 L82 60 Q82 51 90 51 Q98 51 98 60 L98 75" fill="none" stroke={frame} strokeWidth="1.2" strokeOpacity="0.75" />
      {/* inner glow line */}
      <path d="M84 75 L84 61 Q84 54 90 54 Q96 54 96 61 L96 75" fill="none" stroke={frame} strokeWidth="0.5" strokeOpacity="0.4" />
      {/* keystone */}
      <rect x="88.8" y="50" width="2.4" height="2.6" rx="0.5" fill={frame} opacity="0.7" />
      {/* threshold step on the floor line */}
      <rect x="79.5" y="74" width="21" height="1.8" rx="0.7" fill={frame} opacity="0.5" />
    </g>
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
  showCoords,
  onSolved,
  onWrong,
}: {
  puzzle: EscapeRoomPuzzle;
  solved: boolean;
  /** Word-search targets not yet lit up by another machine (shown as ❓). */
  hiddenWords?: Set<string>;
  /** Picture (emoji) clue to show for each revealed word instead of its text. */
  wordHints?: Map<string, string>;
  /** Show numbered Column/Row axes on a word search (for coordinate exits). */
  showCoords?: boolean;
  onSolved: () => void;
  onWrong: () => void;
}) {
  if (puzzle.kind === "mcq") return <McqPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "code") return <CodePuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "cipher")
    return <CipherPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "circuit")
    return <CircuitPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "sort")
    return <SortPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "maze")
    return <MazePuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "fair")
    return <FairPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "wordsearch")
    return (
      <WordSearchPuzzle
        puzzle={puzzle}
        solved={solved}
        hiddenWords={hiddenWords}
        wordHints={wordHints}
        showCoords={showCoords}
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

/**
 * Symbol decoder (substitution cipher): each symbol stands for its own letter
 * in the key, so there's nothing to spin through — the player has to look up
 * each coded symbol and type the word it spells.
 */
function CipherPuzzle({
  puzzle,
  solved,
  onSolved,
  onWrong,
}: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "cipher" }>>) {
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (solved) return;
    if (value.trim().toUpperCase() === puzzle.answer.trim().toUpperCase()) onSolved();
    else {
      onWrong();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      {/* Decoder key: symbol → letter legend */}
      <div className="mx-auto mt-4 max-w-sm rounded-2xl bg-slate-900 p-4 ring-2 ring-slate-700">
        <p className="font-fun text-xs font-700 uppercase tracking-wider text-slate-400">🔑 Decoder Key</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {puzzle.symbols.map((sym, i) => (
            <div key={sym} className="flex flex-col items-center rounded-lg bg-slate-800 py-1.5">
              <span className="text-xl">{sym}</span>
              <span className="font-mono text-sm font-700 text-mint">{puzzle.letters[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coded message */}
      <p className="mt-4 font-fun text-sm font-600 text-slate-500">The secret word reads:</p>
      <div className="mt-2 flex justify-center gap-2">
        {puzzle.coded.map((sym, k) => (
          <span
            key={k}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl ring-2 ring-amber-200"
          >
            {sym}
          </span>
        ))}
      </div>

      {/* Type the decoded word */}
      <form onSubmit={submit} className="mt-4 flex justify-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          disabled={solved}
          placeholder="Type the word"
          aria-label="Type the decoded word"
          className={`w-44 rounded-full border-2 px-5 py-2.5 text-center font-fun text-lg font-700 uppercase tracking-widest text-slate-800 outline-none transition ${
            shake ? "animate-pulse border-coral" : "border-amber-200 focus:border-coral"
          }`}
        />
        <button
          type="submit"
          disabled={solved || !value.trim()}
          className="rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
        >
          Decode 🔓
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Circuit connector — rotate pipes to link the power to the bulb      */
/* ------------------------------------------------------------------ */

const DIR_SEQ: Dir[] = ["N", "E", "S", "W"];
const DIR_VEC: Record<Dir, [number, number]> = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const DIR_OPP: Record<Dir, Dir> = { N: "S", E: "W", S: "N", W: "E" };

/** Rotate a tile's open sides `rot` quarter-turns clockwise. */
function rotateSides(sides: Dir[], rot: number): Dir[] {
  return sides.map((d) => DIR_SEQ[(DIR_SEQ.indexOf(d) + rot) % 4]);
}

function CircuitPuzzle({
  puzzle,
  solved,
  onSolved,
}: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "circuit" }>>) {
  const rows = puzzle.tiles.length;
  const cols = puzzle.tiles[0].length;
  const [rots, setRots] = useState<number[][]>(() => puzzle.tiles.map((row) => row.map((t) => ((t.rot % 4) + 4) % 4)));

  const sidesAt = (r: number, c: number) => rotateSides(puzzle.tiles[r][c].sides, rots[r][c]);

  // Flood-fill from the power source; collect every cell it reaches.
  const powered = useMemo(() => {
    const seen = new Set<string>();
    const start = puzzle.start;
    if (!rotateSides(puzzle.tiles[start.r][start.c].sides, rots[start.r][start.c]).includes(start.from)) return seen;
    const queue: [number, number][] = [[start.r, start.c]];
    seen.add(`${start.r},${start.c}`);
    while (queue.length) {
      const [r, c] = queue.shift()!;
      for (const d of rotateSides(puzzle.tiles[r][c].sides, rots[r][c])) {
        const [dr, dc] = DIR_VEC[d];
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        if (!rotateSides(puzzle.tiles[nr][nc].sides, rots[nr][nc]).includes(DIR_OPP[d])) continue;
        const k = `${nr},${nc}`;
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nr, nc]);
      }
    }
    return seen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rots, puzzle, rows, cols]);

  const lit =
    powered.has(`${puzzle.end.r},${puzzle.end.c}`) && sidesAt(puzzle.end.r, puzzle.end.c).includes(puzzle.end.to);

  useEffect(() => {
    if (lit && !solved) onSolved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit, solved]);

  function tap(r: number, c: number) {
    if (solved) return;
    setRots((prev) => prev.map((row, rr) => row.map((v, cc) => (rr === r && cc === c ? (v + 1) % 4 : v))));
  }

  const bar = (on: boolean) => (on ? "bg-amber-400" : "bg-slate-300");

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      <div className="mt-4 flex items-center justify-center gap-1">
        <span className={`text-2xl transition ${lit ? "" : "animate-pulse"}`}>⚡</span>
        <div
          className="grid gap-1 rounded-2xl bg-slate-900 p-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {puzzle.tiles.map((row, r) =>
            row.map((_, c) => {
              const on = powered.has(`${r},${c}`);
              const sides = sidesAt(r, c);
              const isStart = r === puzzle.start.r && c === puzzle.start.c;
              const isEnd = r === puzzle.end.r && c === puzzle.end.c;
              return (
                <button
                  key={`${r},${c}`}
                  onClick={() => tap(r, c)}
                  disabled={solved}
                  aria-label={`Pipe ${r + 1},${c + 1}`}
                  className="relative h-12 w-12 rounded-md bg-slate-800 ring-1 ring-slate-700 transition hover:bg-slate-700 disabled:cursor-default sm:h-14 sm:w-14"
                >
                  {/* centre hub */}
                  <span
                    className={`absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${bar(on)}`}
                  />
                  {sides.includes("N") && (
                    <span className={`absolute left-1/2 top-0 h-1/2 w-2 -translate-x-1/2 rounded-full ${bar(on)}`} />
                  )}
                  {sides.includes("S") && (
                    <span className={`absolute bottom-0 left-1/2 h-1/2 w-2 -translate-x-1/2 rounded-full ${bar(on)}`} />
                  )}
                  {sides.includes("E") && (
                    <span className={`absolute right-0 top-1/2 h-2 w-1/2 -translate-y-1/2 rounded-full ${bar(on)}`} />
                  )}
                  {sides.includes("W") && (
                    <span className={`absolute left-0 top-1/2 h-2 w-1/2 -translate-y-1/2 rounded-full ${bar(on)}`} />
                  )}
                  {isStart && <span className="absolute -left-0.5 -top-0.5 text-xs">⚡</span>}
                  {isEnd && <span className="absolute -right-0.5 -top-0.5 text-xs">💡</span>}
                </button>
              );
            }),
          )}
        </div>
        <span className={`text-2xl transition ${lit ? "animate-bounce" : "opacity-40"}`}>💡</span>
      </div>

      <p className="mt-3 font-round text-xs text-slate-400">
        {lit ? "💡 Lit! Clean power is flowing." : "Tap a pipe to spin it. Link ⚡ all the way to 💡."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sort — drop statements into the right bin                           */
/* ------------------------------------------------------------------ */

function SortPuzzle({ puzzle, solved, onSolved, onWrong }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "sort" }>>) {
  const [placed, setPlaced] = useState<Record<number, number>>({});
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);

  function drop(i: number, bin: number) {
    if (solved || placed[i] !== undefined) return;
    if (puzzle.items[i].bin === bin) {
      const next = { ...placed, [i]: bin };
      setPlaced(next);
      if (puzzle.items.every((_, k) => next[k] !== undefined)) onSolved();
    } else {
      onWrong();
      setShakeIdx(i);
      setTimeout(() => setShakeIdx((s) => (s === i ? null : s)), 450);
    }
  }

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {puzzle.bins.map((b, bi) => (
          <div
            key={bi}
            className="rounded-2xl bg-amber-50 py-2 font-fun text-sm font-700 text-slate-600 ring-1 ring-amber-100"
          >
            {b.emoji} {b.label} bin
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2">
        {puzzle.items.map((it, i) => {
          const done = placed[i] !== undefined;
          if (done) {
            const b = puzzle.bins[placed[i]];
            return (
              <div
                key={i}
                className="rounded-2xl bg-mint/15 px-4 py-2.5 font-fun text-sm font-600 text-emerald-700 ring-1 ring-emerald-200"
              >
                {b.emoji} &ldquo;{it.text}&rdquo;
              </div>
            );
          }
          return (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-2 transition ${
                shakeIdx === i ? "animate-pulse ring-coral" : "ring-amber-100"
              }`}
            >
              <span className="flex-1 text-left font-fun text-sm font-600 text-slate-700">&ldquo;{it.text}&rdquo;</span>
              {puzzle.bins.map((b, bi) => (
                <button
                  key={bi}
                  onClick={() => drop(i, bi)}
                  disabled={solved}
                  aria-label={`Put in ${b.label} bin`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-lg ring-1 ring-amber-100 transition hover:scale-110 hover:bg-amber-100"
                >
                  {b.emoji}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <p className="mt-3 font-round text-xs text-slate-400">Tap a bin button to drop each statement in.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Maze — walk the honest path; lies dead-end                          */
/* ------------------------------------------------------------------ */

function MazePuzzle({ puzzle, solved, onSolved }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "maze" }>>) {
  const grid = puzzle.grid;
  const ends = useMemo(() => {
    let s: [number, number] = [1, 1];
    let g: [number, number] = [1, 1];
    grid.forEach((row, r) =>
      row.split("").forEach((ch, c) => {
        if (ch === "S") s = [r, c];
        if (ch === "G") g = [r, c];
      }),
    );
    return { s, g };
  }, [grid]);

  // The squares around a cell (3×3) — what the hero can see from there.
  const reveal = (p: [number, number]) => {
    const out: string[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const r = p[0] + dr;
        const c = p[1] + dc;
        if (r >= 0 && c >= 0 && r < grid.length && c < grid[0].length) out.push(`${r},${c}`);
      }
    return out;
  };

  const [pos, setPos] = useState(ends.s);
  const [seen, setSeen] = useState<Set<string>>(() => new Set(reveal(ends.s)));
  const atGoal = pos[0] === ends.g[0] && pos[1] === ends.g[1];

  useEffect(() => {
    if (atGoal && !solved) onSolved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atGoal, solved]);

  // Fog of war: light up the squares around the hero as they explore.
  useEffect(() => {
    setSeen((prev) => {
      const next = new Set(prev);
      reveal(pos).forEach((k) => next.add(k));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  function move(dr: number, dc: number) {
    if (solved) return;
    const nr = pos[0] + dr;
    const nc = pos[1] + dc;
    if (nr < 0 || nc < 0 || nr >= grid.length || nc >= grid[0].length) return;
    if (grid[nr][nc] === "#") return;
    setPos([nr, nc]);
  }

  const sign = puzzle.signs?.find((s) => s.at[0] === pos[0] && s.at[1] === pos[1]);
  const dpad =
    "flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-xl ring-2 ring-amber-100 transition hover:bg-amber-100 disabled:opacity-40";

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      <div className="mt-4 flex justify-center">
        <div
          className="inline-grid gap-0.5 rounded-xl bg-slate-900 p-2"
          style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))` }}
        >
          {grid.map((row, r) =>
            row.split("").map((ch, c) => {
              const key = `${r},${c}`;
              const visible = seen.has(key);
              const isWall = ch === "#";
              const here = pos[0] === r && pos[1] === c;
              const isGoal = ch === "G";
              return (
                <div
                  key={key}
                  className={`flex h-6 w-6 items-center justify-center rounded-sm text-sm ${
                    !visible ? "bg-slate-950" : isWall ? "bg-slate-700" : "bg-slate-100"
                  }`}
                >
                  {visible ? (here ? "🦸" : isGoal ? puzzle.goalEmoji ?? "💙" : "") : ""}
                </div>
              );
            }),
          )}
        </div>
      </div>

      {sign && !atGoal && (
        <div className="mx-auto mt-3 max-w-sm rounded-2xl bg-sky/10 p-3 font-round text-sm text-sky-800 ring-1 ring-sky/20">
          {sign.text}
        </div>
      )}

      <div className="mt-3 inline-grid grid-cols-3 gap-1">
        <span />
        <button onClick={() => move(-1, 0)} disabled={solved} aria-label="Up" className={dpad}>
          ⬆️
        </button>
        <span />
        <button onClick={() => move(0, -1)} disabled={solved} aria-label="Left" className={dpad}>
          ⬅️
        </button>
        <span className="flex items-center justify-center font-fun text-[10px] font-700 text-slate-400">move</span>
        <button onClick={() => move(0, 1)} disabled={solved} aria-label="Right" className={dpad}>
          ➡️
        </button>
        <span />
        <button onClick={() => move(1, 0)} disabled={solved} aria-label="Down" className={dpad}>
          ⬇️
        </button>
        <span />
      </div>
      <p className="mt-3 font-round text-xs text-slate-400">
        {atGoal
          ? puzzle.wonText ?? "💙 You reached the core the honest way!"
          : puzzle.caption ?? "Use the arrows to walk to 💙 — lies lead to dead ends."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fair — share the treats equally among the animals                   */
/* ------------------------------------------------------------------ */

function FairPuzzle({ puzzle, solved, onSolved }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "fair" }>>) {
  const [counts, setCounts] = useState<number[]>(() => puzzle.animals.map(() => 0));
  const given = counts.reduce((a, b) => a + b, 0);
  const left = puzzle.total - given;
  const fair = left === 0 && counts.every((c) => c === counts[0]);

  useEffect(() => {
    if (fair && !solved) onSolved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fair, solved]);

  function give(i: number, delta: number) {
    if (solved) return;
    setCounts((prev) => {
      const total = prev.reduce((a, b) => a + b, 0);
      if (delta > 0 && total >= puzzle.total) return prev;
      const v = prev[i] + delta;
      if (v < 0) return prev;
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  const stepBtn =
    "flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 font-fun text-xl font-700 text-slate-600 ring-1 ring-amber-200 transition hover:bg-amber-200 disabled:opacity-30";

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-4 py-1.5 font-fun text-sm font-700 text-slate-600 ring-1 ring-amber-100">
        {puzzle.treat} {left} left to share
      </div>

      <div className="mt-4 grid gap-3">
        {puzzle.animals.map((a, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 ring-1 ring-amber-100">
            <span className="text-3xl">{a}</span>
            <div className="flex min-h-[1.75rem] flex-1 flex-wrap content-center justify-center gap-0.5 text-lg">
              {Array.from({ length: counts[i] }).map((_, k) => (
                <span key={k}>{puzzle.treat}</span>
              ))}
            </div>
            <button onClick={() => give(i, -1)} disabled={solved || counts[i] === 0} aria-label="Take one" className={stepBtn}>
              −
            </button>
            <button onClick={() => give(i, 1)} disabled={solved || left === 0} aria-label="Give one" className={stepBtn}>
              +
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 font-round text-xs text-slate-400">
        {fair ? "💛 Perfectly fair — everyone got the same!" : "Give every animal the same number, and use all the treats."}
      </p>
    </div>
  );
}

function WordSearchPuzzle({
  puzzle,
  solved,
  hiddenWords,
  wordHints,
  showCoords,
  onSolved,
  onWrong,
}: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "wordsearch" }>> & {
  hiddenWords?: Set<string>;
  wordHints?: Map<string, string>;
  showCoords?: boolean;
}) {
  // A fixed `layout` (deterministic puzzles) wins over the random generator.
  const grid = useMemo(
    () => puzzle.layout ?? generateWordGrid(puzzle.words, puzzle.size),
    [puzzle.layout, puzzle.words, puzzle.size],
  );
  const targets = useMemo(() => puzzle.words.map((w) => w.toUpperCase().replace(/[^A-Z]/g, "")), [puzzle.words]);
  const hidden = hiddenWords ?? new Set<string>();
  const anyHidden = targets.some((t) => hidden.has(t));
  const withAxes = !!showCoords && !!puzzle.intersection;
  const crossKey = puzzle.intersection ? `${puzzle.intersection[0]},${puzzle.intersection[1]}` : null;

  const [first, setFirst] = useState<[number, number] | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [badCells, setBadCells] = useState<Set<string>>(new Set());

  const allFound = found.length === targets.length;
  // Until every word's clue is revealed, the poster is scrambled (blurred and
  // unsearchable) — so you can't read the words straight off the grid before
  // solving the machines that light them up.
  const obscured = anyHidden;
  const revealedCount = targets.length - hidden.size;

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
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${grid.length + (withAxes ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {/* Top axis: column numbers */}
          {withAxes && (
            <>
              <span aria-hidden className="h-8 w-8 sm:h-9 sm:w-9" />
              {grid[0].map((_, c) => (
                <span
                  key={`col-${c}`}
                  className="flex h-8 w-8 items-center justify-center font-fun text-xs font-700 text-sky-600 sm:h-9 sm:w-9"
                >
                  {c + 1}
                </span>
              ))}
            </>
          )}

          {grid.map((row, r) => (
            <Fragment key={`row-${r}`}>
              {/* Left axis: row number */}
              {withAxes && (
                <span className="flex h-8 w-8 items-center justify-center font-fun text-xs font-700 text-sky-600 sm:h-9 sm:w-9">
                  {r + 1}
                </span>
              )}
              {row.map((ch, c) => {
                const key = `${r},${c}`;
                const isFound = foundCells.has(key);
                const isBad = badCells.has(key);
                const isFirst = first && first[0] === r && first[1] === c;
                const isCross = withAxes && allFound && key === crossKey;
                const cls = obscured
                  ? "bg-slate-200/70 text-slate-400 ring-slate-200 blur-[3px] select-none"
                  : isCross
                    ? "bg-sunny/80 text-slate-900 ring-amber-500 animate-pulse"
                    : isFound
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
                    disabled={solved || obscured}
                    aria-hidden={obscured}
                    className={`flex h-8 w-8 items-center justify-center rounded-md font-mono text-sm font-700 ring-1 transition disabled:cursor-default sm:h-9 sm:w-9 ${cls}`}
                  >
                    {isCross ? "⭐" : ch}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <p className="mt-3 font-round text-xs text-slate-400">
        {obscured
          ? `🔒 The display is scrambled — solve the machines to light it up (${revealedCount}/${targets.length} clues lit).`
          : withAxes && allFound
            ? "⭐ The three words cross here! Read its Column ➡️ and Row ⬇️ — that's the door code."
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

  if (puzzle.kind === "cipher") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 inline-block rounded-2xl bg-mint/20 px-5 py-2 font-mono text-xl font-700 tracking-widest text-emerald-700 ring-1 ring-emerald-300">
          ✅ {puzzle.answer.toUpperCase()}
        </div>
      </div>
    );
  }

  if (puzzle.kind === "circuit") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 rounded-2xl bg-mint/20 px-4 py-3 font-fun font-700 text-emerald-700 ring-1 ring-emerald-300">
          ✅ ⚡ connected to 💡 — power restored!
        </div>
      </div>
    );
  }

  if (puzzle.kind === "sort") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 grid gap-1.5 text-left">
          {puzzle.items.map((it, i) => (
            <div
              key={i}
              className="rounded-xl bg-mint/15 px-3 py-1.5 font-fun text-sm font-600 text-emerald-700 ring-1 ring-emerald-200"
            >
              {puzzle.bins[it.bin].emoji} &ldquo;{it.text}&rdquo;
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (puzzle.kind === "maze" || puzzle.kind === "fair") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 rounded-2xl bg-mint/20 px-4 py-3 font-fun font-700 text-emerald-700 ring-1 ring-emerald-300">
          ✅ Core charged!
        </div>
      </div>
    );
  }

  // wordsearch — picture clues + words, plus the crossing grid for re-checking
  // the Column/Row at keypad time.
  const layout = puzzle.layout;
  const cross = puzzle.intersection;
  return (
    <div className="mt-3 text-center">
      <p className="font-fun font-700 text-slate-800">Found them all! 🎉</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
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

      {layout && cross && (
        <>
          <div className="mt-3 flex justify-center">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${layout.length + 1}, minmax(0, 1fr))` }}
            >
              <span aria-hidden className="h-7 w-7 sm:h-8 sm:w-8" />
              {layout[0].map((_, c) => (
                <span
                  key={`c${c}`}
                  className="flex h-7 w-7 items-center justify-center font-fun text-[10px] font-700 text-sky-600 sm:h-8 sm:w-8"
                >
                  {c + 1}
                </span>
              ))}
              {layout.map((row, r) => (
                <Fragment key={`r${r}`}>
                  <span className="flex h-7 w-7 items-center justify-center font-fun text-[10px] font-700 text-sky-600 sm:h-8 sm:w-8">
                    {r + 1}
                  </span>
                  {row.map((ch, c) => {
                    const isCross = r === cross[0] && c === cross[1];
                    return (
                      <span
                        key={`${r},${c}`}
                        className={`flex h-7 w-7 items-center justify-center rounded font-mono text-[11px] font-700 sm:h-8 sm:w-8 ${
                          isCross ? "bg-sunny/80 text-slate-900 ring-2 ring-amber-500" : "bg-amber-50 text-slate-400"
                        }`}
                      >
                        {isCross ? "⭐" : ch}
                      </span>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <p className="mt-2 font-round text-xs text-slate-500">
            ⭐ The crossing — read its Column ➡️ and Row ⬇️ for the door.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exit keypad — type the code collected from the machines            */
/* ------------------------------------------------------------------ */

/**
 * The door's number lock. Each box is one part of the code (e.g. Column, Row),
 * labelled so the player knows what to read off the word search and type in.
 */
function ExitKeypad({
  slots,
  code,
  outro,
  onClose,
  onEscape,
}: {
  slots: { label: string; emoji: string; value: string }[];
  code: string;
  outro: string;
  onClose: () => void;
  onEscape: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(() => slots.map(() => ""));
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
    if (d && i < slots.length - 1) refs.current[i + 1]?.focus();
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
              Where the three words crossed on the display — type that square&apos;s Column and Row.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              {slots.map((s, i) => (
                <div key={s.label} className="flex flex-col items-center gap-1">
                  <span className="font-fun text-xs font-700 text-slate-500">
                    {s.emoji} {s.label}
                  </span>
                  <input
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    value={digits[i]}
                    onChange={(e) => setDigit(i, e.target.value)}
                    inputMode="numeric"
                    aria-label={s.label}
                    className={`h-16 w-14 rounded-2xl border-2 text-center font-mono text-3xl font-700 text-slate-800 outline-none transition ${
                      shake ? "animate-pulse border-coral" : "border-amber-200 focus:border-coral"
                    }`}
                  />
                </div>
              ))}
            </div>
            {shake && (
              <p className="mt-3 font-fun text-sm font-600 text-coral">
                That code didn&apos;t work — pop back to the display and check the crossing! 🔁
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

/* ------------------------------------------------------------------ */
/* Cipher door — decode the message the machines powered up           */
/* ------------------------------------------------------------------ */

/**
 * The Green Lab's exit. Three machines each power one piece of the decoder —
 * the key symbols, the key letters, and the coded message. Pieces that aren't
 * powered yet show as ❓; once all three are in, the player decodes the word and
 * types it to escape.
 */
function CipherExitKeypad({
  exit,
  solvedIds,
  outro,
  onClose,
  onEscape,
}: {
  exit: RoomCipherExit;
  solvedIds: string[];
  outro: string;
  onClose: () => void;
  onEscape: () => void;
}) {
  const symbolsOn = solvedIds.includes(exit.revealSymbols);
  const lettersOn = solvedIds.includes(exit.revealLetters);
  const codedOn = solvedIds.includes(exit.revealCoded);
  const ready = symbolsOn && lettersOn && codedOn;

  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);
  const [ok, setOk] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ok || !ready) return;
    if (value.trim().toUpperCase() === exit.answer.trim().toUpperCase()) {
      setOk(true);
      window.setTimeout(onEscape, 800);
    } else {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    }
  }

  const checklist = [
    { on: symbolsOn, label: "Key symbols" },
    { on: lettersOn, label: "Key letters" },
    { on: codedOn, label: "Secret message" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close decoder"
        onClick={() => !ok && onClose()}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-7 text-center shadow-2xl ring-1 ring-amber-100">
        <div className="text-5xl">🔣</div>
        <h3 className="mt-2 font-fun text-2xl font-700 text-slate-900">Door Decoder</h3>

        {ok ? (
          <div className="mt-5 rounded-2xl bg-mint/15 p-5 ring-1 ring-mint/30">
            <div className="font-fun text-lg font-700 text-emerald-700">🎉 Code accepted — the door swings open!</div>
            <p className="mt-1 font-round text-sm text-slate-600">{outro}</p>
          </div>
        ) : (
          <>
            {/* Which machines have powered which piece */}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {checklist.map((c) => (
                <span
                  key={c.label}
                  className={`rounded-full px-3 py-1 font-fun text-xs font-700 ring-1 ${
                    c.on ? "bg-mint/20 text-emerald-700 ring-emerald-300" : "bg-slate-100 text-slate-400 ring-slate-200"
                  }`}
                >
                  {c.on ? "✅" : "🔒"} {c.label}
                </span>
              ))}
            </div>

            {/* Decoder key: symbol over letter (❓ until its machine is fixed) */}
            <div className="mt-4 rounded-2xl bg-slate-900 p-4 ring-2 ring-slate-700">
              <p className="font-fun text-xs font-700 uppercase tracking-wider text-slate-400">🔑 Decoder Key</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {exit.symbols.map((sym, i) => (
                  <div key={i} className="flex flex-col items-center rounded-lg bg-slate-800 py-1.5">
                    <span className="text-lg">{symbolsOn ? sym : "❓"}</span>
                    <span className="font-mono text-sm font-700 text-mint">{lettersOn ? exit.letters[i] : "❓"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coded message */}
            <p className="mt-4 font-fun text-sm font-600 text-slate-500">The door reads:</p>
            <div className="mt-2 flex justify-center gap-2">
              {exit.coded.map((sym, k) => (
                <span
                  key={k}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl ring-2 ring-amber-200"
                >
                  {codedOn ? sym : "❓"}
                </span>
              ))}
            </div>

            <form onSubmit={submit} className="mt-4 flex justify-center gap-2">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
                disabled={!ready}
                placeholder={ready ? "Type the word" : "Power all 3 machines"}
                aria-label="Type the decoded word"
                className={`w-48 rounded-full border-2 px-5 py-2.5 text-center font-fun text-lg font-700 uppercase tracking-widest text-slate-800 outline-none transition disabled:bg-slate-50 disabled:text-slate-300 ${
                  shake ? "animate-pulse border-coral" : "border-amber-200 focus:border-coral"
                }`}
              />
              <button
                type="submit"
                disabled={!ready || !value.trim()}
                className="rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
              >
                Decode 🔓
              </button>
            </form>
            {shake && (
              <p className="mt-3 font-fun text-sm font-600 text-coral">That&apos;s not it — check the key and try again! 🔁</p>
            )}
            <div className="mt-5">
              <button onClick={onClose} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
                ← Back to the lab
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Unscramble door — each core unlocks a scrambled word to fix         */
/* ------------------------------------------------------------------ */

/**
 * The hero-suit exit. Each core (station) reveals one scrambled word; until its
 * core is charged the word shows as 🔒. Unscramble all of them to power the
 * suit and escape.
 */
function UnscrambleExitKeypad({
  exit,
  solvedIds,
  outro,
  done: doneIdx,
  onWordSolved,
  onClose,
  onEscape,
}: {
  exit: RoomUnscrambleExit;
  solvedIds: string[];
  outro: string;
  done: number[];
  onWordSolved: (i: number) => void;
  onClose: () => void;
  onEscape: () => void;
}) {
  const [vals, setVals] = useState<string[]>(() => exit.words.map(() => ""));
  const done = exit.words.map((_, i) => doneIdx.includes(i));
  const allDone = done.every(Boolean);
  const [shake, setShake] = useState<number | null>(null);
  const [ok, setOk] = useState(false);

  // If every core was already unscrambled (e.g. solved, then closed before the
  // power-up animation finished), reopening the console completes the escape.
  useEffect(() => {
    if (allDone && !ok) {
      setOk(true);
      const t = window.setTimeout(onEscape, 800);
      return () => window.clearTimeout(t);
    }
  }, [allDone, ok, onEscape]);

  function check(i: number, e: React.FormEvent) {
    e.preventDefault();
    const w = exit.words[i];
    if (!solvedIds.includes(w.reveal) || done[i]) return;
    if (vals[i].trim().toUpperCase() === w.answer.trim().toUpperCase()) {
      onWordSolved(i);
      if (done.every((d, k) => d || k === i)) {
        setOk(true);
        window.setTimeout(onEscape, 800);
      }
    } else {
      setShake(i);
      window.setTimeout(() => setShake((s) => (s === i ? null : s)), 450);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close suit console"
        onClick={() => !ok && onClose()}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-7 text-center shadow-2xl ring-1 ring-amber-100">
        <div className="text-5xl">🦸</div>
        <h3 className="mt-2 font-fun text-2xl font-700 text-slate-900">Suit Power Core</h3>

        {ok ? (
          <div className="mt-5 rounded-2xl bg-mint/15 p-5 ring-1 ring-mint/30">
            <div className="font-fun text-lg font-700 text-emerald-700">🎉 Suit fully charged — power up!</div>
            <p className="mt-1 font-round text-sm text-slate-600">{outro}</p>
          </div>
        ) : (
          <>
            <p className="mx-auto mt-1 max-w-xs font-round text-sm text-slate-500">
              Charge a core to reveal its scrambled word, then unscramble all three.
            </p>
            <div className="mt-4 grid gap-3">
              {exit.words.map((w, i) => {
                const revealed = solvedIds.includes(w.reveal);
                return (
                  <div key={i} className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100">
                    <div className="font-fun text-xs font-700 text-slate-500">
                      {w.emoji} {w.core}
                    </div>
                    {done[i] ? (
                      <div className="mt-1 font-fun text-lg font-700 tracking-widest text-emerald-700">✅ {w.answer}</div>
                    ) : revealed ? (
                      <>
                        <div className="mt-1 font-mono text-2xl font-700 tracking-[0.3em] text-grape">{w.scrambled}</div>
                        <form onSubmit={(e) => check(i, e)} className="mt-2 flex justify-center gap-2">
                          <input
                            value={vals[i]}
                            onChange={(e) =>
                              setVals((v) => v.map((x, k) => (k === i ? e.target.value.toUpperCase() : x)))
                            }
                            placeholder="Unscramble"
                            aria-label={`Unscramble ${w.core}`}
                            className={`w-36 rounded-full border-2 px-4 py-2 text-center font-fun text-base font-700 uppercase tracking-widest text-slate-800 outline-none transition ${
                              shake === i ? "animate-pulse border-coral" : "border-amber-200 focus:border-coral"
                            }`}
                          />
                          <button
                            type="submit"
                            disabled={!vals[i].trim()}
                            className="rounded-full bg-coral px-4 py-2 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
                          >
                            Fix
                          </button>
                        </form>
                      </>
                    ) : (
                      <div className="mt-1 font-fun text-lg font-700 text-slate-300">🔒 Core not charged yet</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5">
              <button onClick={onClose} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
                ← Back to the lab
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
