"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  PHONICS_STAGES,
  phonemeOf,
  stageRounds,
  starsForMistakes,
  type AccentKey,
  type PhonicsStage,
  type PopRound,
  type BuildRound,
  type RhymeRound,
  type ListenRound,
} from "@/lib/phonics/content";

/* ---- Per-world accent classes (literal so Tailwind keeps them) ---- */
const ACCENTS: Record<AccentKey, { solid: string; text: string; soft: string; ring: string; softText: string }> = {
  bubble: { solid: "bg-bubble", text: "text-bubble", soft: "bg-bubble/15", ring: "ring-bubble/30", softText: "text-bubble" },
  tangerine: { solid: "bg-tangerine", text: "text-orange-600", soft: "bg-tangerine/15", ring: "ring-tangerine/30", softText: "text-orange-600" },
  grape: { solid: "bg-grape", text: "text-grape", soft: "bg-grape/15", ring: "ring-grape/30", softText: "text-grape" },
  mint: { solid: "bg-mint", text: "text-emerald-600", soft: "bg-mint/15", ring: "ring-mint/30", softText: "text-emerald-600" },
  sky: { solid: "bg-sky-500", text: "text-sky-600", soft: "bg-sky-100", ring: "ring-sky-200", softText: "text-sky-600" },
};

/* ---- Speech (browser, offline) ---- */
function useSpeaker() {
  return useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.8;
    u.pitch = 1.2;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);
}

/* ---- Local progress (best stars per world) ---- */
const STORE_KEY = "ai4kids.phonics";
type Stars = Record<string, number>;

function loadStars(): Stars {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Stars;
  } catch {
    return {};
  }
}

/* ---- Small shared bits ---- */
function StarRow({ filled, size = "text-xl" }: { filled: number; size?: string }) {
  return (
    <div className={`flex ${size}`}>
      {[0, 1, 2].map((s) => (
        <span key={s} className={s < filled ? "" : "opacity-25 grayscale"}>
          ⭐
        </span>
      ))}
    </div>
  );
}

function HearButton({ onClick, accent, label = "Hear it" }: { onClick: () => void; accent: AccentKey; label?: string }) {
  const a = ACCENTS[accent];
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-fun text-sm font-700 shadow-sm ring-1 ring-slate-100 ${a.softText}`}
    >
      🔊 {label}
    </button>
  );
}

function RoundFeedback({ solved, wrong, isLast, accent, onNext }: { solved: boolean; wrong: boolean; isLast: boolean; accent: AccentKey; onNext: () => void }) {
  const a = ACCENTS[accent];
  if (solved) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="font-fun text-lg font-700 text-emerald-600">Great job! 🎉</p>
        <button onClick={onNext} className={`rounded-full ${a.solid} px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105`}>
          {isLast ? "Finish ▶" : "Next ▶"}
        </button>
      </div>
    );
  }
  if (wrong) {
    return <p className="text-center font-round font-600 text-coral">Not quite — listen again and try once more! 🙂</p>;
  }
  return null;
}

/* ---- Optional Claude "Buddy" ---- */
type BuddyReq =
  | { type: "hint"; game: "pop" | "build" | "rhyme" | "listen"; word: string; answer?: string }
  | { type: "praise"; title: string; subtitle: string; stars: number };

function PhonicsBuddy({ enabled, req, accent, speak, resetKey }: { enabled: boolean; req: BuddyReq; accent: AccentKey; speak: (t: string) => void; resetKey: string }) {
  const a = ACCENTS[accent];
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setHint(null);
  }, [resetKey]);
  if (!enabled) return null;
  async function ask() {
    setBusy(true);
    try {
      const res = await fetch("/api/learn/phonics-buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const d = await res.json();
      const msg = (d.message as string | null) ?? "Listen to the word again and sound it out slowly!";
      setHint(msg);
      speak(msg);
    } catch {
      setHint("Listen to the word again and sound it out slowly!");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <button
        onClick={ask}
        disabled={busy}
        className={`inline-flex items-center gap-2 rounded-full ${a.solid} px-5 py-2 font-fun text-sm font-700 text-white shadow transition hover:scale-105 disabled:opacity-60`}
      >
        ✨ {busy ? "Thinking…" : "Ask Buddy"}
      </button>
      {hint && <p className={`w-full rounded-2xl ${a.soft} p-3 text-center font-round text-sm text-slate-700`}>🤖 {hint}</p>}
    </div>
  );
}

/* ============================ Mini-games ============================ */

function PopGame({ rounds, accent, speak, buddy, onProgress, onFinish }: GameProps<PopRound>) {
  const a = ACCENTS[accent];
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const round = rounds[index];
  const options = useMemo(() => [...round.options].sort(() => Math.random() - 0.5), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const isLast = index + 1 >= rounds.length;

  useEffect(() => {
    onProgress(index, rounds.length);
    setSolved(false);
    const t = setTimeout(() => speak(round.word), 250);
    return () => clearTimeout(t);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wrong == null) return;
    const t = setTimeout(() => setWrong(null), 1300);
    return () => clearTimeout(t);
  }, [wrong]);

  function pick(i: number) {
    if (wrong != null || solved) return;
    if (options[i] === round.answer) setSolved(true);
    else {
      setWrong(i);
      setMistakes((m) => m + 1);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className={`flex w-full flex-col items-center gap-2 rounded-3xl bg-white p-6 shadow-sm ring-1 ${a.ring}`}>
        <div className="text-7xl">{round.emoji}</div>
        <div className="font-fun text-2xl font-700 text-slate-900">{round.word}</div>
        <HearButton onClick={() => speak(round.word)} accent={accent} />
      </div>
      <p className="text-center font-round font-600 text-slate-500">Hear each sound, then pick the one it starts with!</p>
      <div className="flex justify-center gap-3">
        {options.map((c, i) => (
          <div key={i} className={`flex w-24 flex-col items-center gap-2 rounded-3xl p-3 shadow-sm ring-1 ${wrong === i ? "bg-coral/15 ring-coral/30" : "bg-white ring-slate-100"}`}>
            <div className={`font-fun text-3xl font-700 ${a.text}`}>{i + 1}</div>
            <button onClick={() => speak(phonemeOf(c))} className={`rounded-full ${a.soft} px-3 py-1.5 font-fun text-xs font-700 ${a.softText}`}>
              🔊 Hear
            </button>
            <button onClick={() => pick(i)} className={`w-full rounded-xl ${a.solid} py-1.5 font-fun text-sm font-700 text-white`}>
              Pick
            </button>
          </div>
        ))}
      </div>
      <RoundFeedback solved={solved} wrong={wrong != null} isLast={isLast} accent={accent} onNext={() => (isLast ? onFinish(mistakes) : setIndex(index + 1))} />
      {buddy && <PhonicsBuddy enabled resetKey={`pop-${round.word}`} req={{ type: "hint", game: "pop", word: round.word, answer: round.answer }} accent={accent} speak={speak} />}
    </div>
  );
}

function BuildGame({ rounds, accent, speak, buddy, onProgress, onFinish }: GameProps<BuildRound>) {
  const a = ACCENTS[accent];
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [solved, setSolved] = useState(false);
  const [used, setUsed] = useState<number[]>([]);
  const [wrongTile, setWrongTile] = useState<number | null>(null);
  const round = rounds[index];
  const target = round.word;
  const tiles = useMemo(() => [...target].sort(() => Math.random() - 0.5), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const builtLen = used.length;
  const isLast = index + 1 >= rounds.length;

  useEffect(() => {
    onProgress(index, rounds.length);
    setSolved(false);
    setUsed([]);
    const t = setTimeout(() => speak(round.word), 250);
    return () => clearTimeout(t);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wrongTile == null) return;
    const t = setTimeout(() => setWrongTile(null), 500);
    return () => clearTimeout(t);
  }, [wrongTile]);

  function tap(i: number, ch: string) {
    if (used.includes(i) || wrongTile != null || solved) return;
    if (ch === target[builtLen]) {
      const next = [...used, i];
      setUsed(next);
      speak(ch);
      if (next.length === target.length) {
        setTimeout(() => speak(target), 300);
        setSolved(true);
      }
    } else {
      setWrongTile(i);
      setMistakes((m) => m + 1);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="font-round font-600 text-slate-500">Spell the word!</p>
      <div className={`flex w-full flex-col items-center gap-3 rounded-3xl bg-white p-6 shadow-sm ring-1 ${a.ring}`}>
        <div className="text-6xl">{round.emoji}</div>
        <HearButton onClick={() => speak(round.word)} accent={accent} />
        <div className="flex gap-2">
          {[...target].map((ch, i) => (
            <div key={i} className={`flex h-12 w-12 items-center justify-center rounded-xl font-fun text-2xl font-700 ${i < builtLen ? `${a.soft} ${a.softText}` : "bg-slate-100 text-transparent"}`}>
              {i < builtLen ? ch : "•"}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        {tiles.map((ch, i) => {
          const isUsed = used.includes(i);
          return (
            <button
              key={i}
              onClick={() => tap(i, ch)}
              disabled={isUsed}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl font-fun text-2xl font-700 shadow-sm ring-1 transition ${
                wrongTile === i ? "bg-coral text-white ring-coral" : isUsed ? "bg-slate-50 text-slate-300 ring-slate-100" : "bg-white text-slate-800 ring-slate-100 hover:scale-105"
              }`}
            >
              {ch}
            </button>
          );
        })}
      </div>
      <RoundFeedback solved={solved} wrong={wrongTile != null} isLast={isLast} accent={accent} onNext={() => (isLast ? onFinish(mistakes) : setIndex(index + 1))} />
      {buddy && <PhonicsBuddy enabled resetKey={`build-${target}`} req={{ type: "hint", game: "build", word: target }} accent={accent} speak={speak} />}
    </div>
  );
}

function RhymeGame({ rounds, accent, speak, buddy, onProgress, onFinish }: GameProps<RhymeRound>) {
  const a = ACCENTS[accent];
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const round = rounds[index];
  const order = useMemo(() => round.options.map((_, i) => i).sort(() => Math.random() - 0.5), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const isLast = index + 1 >= rounds.length;

  useEffect(() => {
    onProgress(index, rounds.length);
    setSolved(false);
    const t = setTimeout(() => speak(round.word), 250);
    return () => clearTimeout(t);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wrong == null) return;
    const t = setTimeout(() => setWrong(null), 1300);
    return () => clearTimeout(t);
  }, [wrong]);

  function pick(orig: number) {
    if (wrong != null || solved) return;
    if (orig === round.answerIndex) {
      speak(round.options[orig].word);
      setSolved(true);
    } else {
      setWrong(orig);
      setMistakes((m) => m + 1);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="font-round font-600 text-slate-500">Which word rhymes?</p>
      <div className={`flex w-full flex-col items-center gap-2 rounded-3xl bg-white p-6 shadow-sm ring-1 ${a.ring}`}>
        <div className="text-6xl">{round.emoji}</div>
        <div className="font-fun text-2xl font-700 text-slate-900">{round.word}</div>
        <HearButton onClick={() => speak(round.word)} accent={accent} />
      </div>
      <div className="flex justify-center gap-3">
        {order.map((orig) => {
          const opt = round.options[orig];
          return (
            <div key={orig} className={`flex w-28 flex-col items-center gap-1.5 rounded-3xl p-4 shadow-sm ring-1 ${wrong === orig ? "bg-coral/15 ring-coral/30" : "bg-white ring-slate-100"}`}>
              <button onClick={() => pick(orig)} className="flex flex-col items-center gap-1">
                <span className="text-4xl">{opt.emoji}</span>
                <span className="font-fun text-sm font-700 text-slate-700">{opt.word}</span>
              </button>
              <button onClick={() => speak(opt.word)} className={`rounded-full ${a.soft} px-3 py-1 font-fun text-xs font-700 ${a.softText}`}>
                🔊
              </button>
            </div>
          );
        })}
      </div>
      <RoundFeedback solved={solved} wrong={wrong != null} isLast={isLast} accent={accent} onNext={() => (isLast ? onFinish(mistakes) : setIndex(index + 1))} />
      {buddy && <PhonicsBuddy enabled resetKey={`rhyme-${round.word}`} req={{ type: "hint", game: "rhyme", word: round.word }} accent={accent} speak={speak} />}
    </div>
  );
}

function ListenGame({ rounds, accent, speak, buddy, onProgress, onFinish }: GameProps<ListenRound>) {
  const a = ACCENTS[accent];
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const round = rounds[index];
  const order = useMemo(() => round.options.map((_, i) => i).sort(() => Math.random() - 0.5), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const isLast = index + 1 >= rounds.length;

  useEffect(() => {
    onProgress(index, rounds.length);
    setSolved(false);
    const t = setTimeout(() => speak(round.word), 300);
    return () => clearTimeout(t);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wrong == null) return;
    const t = setTimeout(() => setWrong(null), 1300);
    return () => clearTimeout(t);
  }, [wrong]);

  function pick(orig: number) {
    if (wrong != null || solved) return;
    if (orig === round.answerIndex) {
      speak(round.options[orig]);
      setSolved(true);
    } else {
      setWrong(orig);
      setMistakes((m) => m + 1);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="text-center font-round font-600 text-slate-500">Listen, then tap the word you hear!</p>
      <div className={`flex w-full flex-col items-center gap-2 rounded-3xl bg-white p-6 shadow-sm ring-1 ${a.ring}`}>
        <button onClick={() => speak(round.word)} className={`flex h-24 w-24 items-center justify-center rounded-full ${a.solid} text-5xl text-white shadow-lg transition hover:scale-105`}>
          🔊
        </button>
        <p className="font-round text-sm font-600 text-slate-400">Tap to hear again</p>
      </div>
      <div className="flex justify-center gap-3">
        {order.map((orig) => {
          const word = round.options[orig];
          return (
            <div key={orig} className={`flex w-28 flex-col items-center gap-1.5 rounded-3xl p-4 shadow-sm ring-1 ${wrong === orig ? "bg-coral/15 ring-coral/30" : "bg-white ring-slate-100"}`}>
              <button onClick={() => pick(orig)} className="font-fun text-xl font-700 text-slate-800">
                {word}
              </button>
              <button onClick={() => speak(word)} className={`rounded-full ${a.soft} px-3 py-1 font-fun text-xs font-700 ${a.softText}`}>
                🔊
              </button>
            </div>
          );
        })}
      </div>
      <RoundFeedback solved={solved} wrong={wrong != null} isLast={isLast} accent={accent} onNext={() => (isLast ? onFinish(mistakes) : setIndex(index + 1))} />
      {buddy && <PhonicsBuddy enabled resetKey={`listen-${round.word}`} req={{ type: "hint", game: "listen", word: round.word }} accent={accent} speak={speak} />}
    </div>
  );
}

type GameProps<R> = {
  rounds: R[];
  accent: AccentKey;
  speak: (t: string) => void;
  buddy: boolean;
  onProgress: (round: number, total: number) => void;
  onFinish: (mistakes: number) => void;
};

/* ============================ Stage host ============================ */

function StageHost({ stage, speak, buddy, onDone, onBack }: { stage: PhonicsStage; speak: (t: string) => void; buddy: boolean; onDone: (stars: number) => void; onBack: () => void }) {
  const a = ACCENTS[stage.accent];
  const total = stageRounds(stage);
  const [round, setRound] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [earned, setEarned] = useState<number | null>(null);
  const [praise, setPraise] = useState<string | null>(null);

  function finish(mistakes: number) {
    const stars = starsForMistakes(mistakes);
    setEarned(stars);
    onDone(stars);
    // Praise (spoken). Uses the Buddy endpoint when available, else a plain cheer.
    if (buddy) {
      fetch("/api/learn/phonics-buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "praise", title: stage.title, subtitle: stage.subtitle, stars }),
      })
        .then((r) => r.json())
        .then((d) => {
          const msg = (d.message as string | null) ?? "Great job!";
          setPraise(msg);
          speak(msg);
        })
        .catch(() => speak("Great job!"));
    } else {
      speak("Great job!");
    }
  }

  const onProgress = useCallback((r: number, _t: number) => setRound(r), []);
  const gp = { accent: stage.accent, speak, buddy, onProgress, onFinish: finish } as const;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-full bg-slate-100 px-4 py-2 font-fun text-sm font-700 text-slate-600 hover:bg-slate-200">
          ← Map
        </button>
        <div className="flex-1 text-center font-fun text-lg font-700 text-slate-800">
          {stage.emoji} {stage.title}
        </div>
        <div className="w-16" />
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <p className="font-round text-sm font-600 text-slate-400">Round {Math.min(round + 1, total)} of {total}</p>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${a.solid} transition-all`} style={{ width: `${(Math.min(round + 1, total) / total) * 100}%` }} />
        </div>
      </div>

      <div className="mt-6 flex min-h-[20rem] flex-col items-center justify-center">
        <div key={attempt} className="w-full">
          {stage.kind === "pop" && <PopGame rounds={stage.pop!} {...gp} />}
          {stage.kind === "build" && <BuildGame rounds={stage.build!} {...gp} />}
          {stage.kind === "rhyme" && <RhymeGame rounds={stage.rhyme!} {...gp} />}
          {stage.kind === "listen" && <ListenGame rounds={stage.listen!} {...gp} />}
        </div>
      </div>

      {earned != null && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-xl ring-1 ring-amber-100">
            <div className="text-6xl">🎉</div>
            <h2 className="mt-2 font-fun text-2xl font-700 text-slate-900">{stage.title} cleared!</h2>
            <div className="mt-3 flex justify-center">
              <StarRow filled={earned} size="text-4xl" />
            </div>
            {praise && <p className={`mt-4 rounded-2xl ${a.soft} p-3 font-round text-sm text-slate-700`}>🤖 {praise}</p>}
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => {
                  setEarned(null);
                  setPraise(null);
                  setRound(0);
                  setAttempt((n) => n + 1);
                }}
                className="rounded-full bg-slate-100 px-5 py-2.5 font-fun font-700 text-slate-600 hover:bg-slate-200"
              >
                Play again 🔁
              </button>
              <button onClick={onBack} className={`rounded-full ${a.solid} px-5 py-2.5 font-fun font-700 text-white shadow`}>
                Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Adventure map ============================ */

export default function PhonicsQuestPage() {
  const speak = useSpeaker();
  const [stars, setStars] = useState<Stars>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [buddy, setBuddy] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    setStars(loadStars());
    fetch("/api/learn/phonics-buddy")
      .then((r) => r.json())
      .then((d) => setBuddy(Boolean(d.enabled)))
      .catch(() => {});
    mounted.current = true;
  }, []);

  const totalStars = useMemo(() => Object.values(stars).reduce((n, v) => n + v, 0), [stars]);
  const isUnlocked = useCallback(
    (i: number) => i <= 0 || (stars[PHONICS_STAGES[i - 1].id] ?? 0) >= 1,
    [stars],
  );

  function recordStars(stageId: string, earned: number) {
    setStars((prev) => {
      if (earned <= (prev[stageId] ?? 0)) return prev;
      const next = { ...prev, [stageId]: earned };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    // Contribute to global points / leaderboard (best-effort, fire-and-forget).
    fetch("/api/learn/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activitySlug: "ai-phonics", score: Math.round((earned / 3) * 100), metadata: { world: stageId, stars: earned } }),
    }).catch(() => {});
  }

  if (selected != null) {
    const stage = PHONICS_STAGES[selected];
    return (
      <StageHost
        stage={stage}
        speak={speak}
        buddy={buddy}
        onDone={(s) => recordStars(stage.id, s)}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
          ← Back to activities
        </Link>
        <div className="inline-flex items-center gap-1 rounded-full bg-sunny/20 px-3 py-1 font-fun text-sm font-700 text-amber-600">
          ⭐ {totalStars}
        </div>
      </div>

      <div className="mt-3 rounded-[2rem] bg-gradient-to-r from-bubble/25 to-sky/25 p-6">
        <h1 className="font-fun text-3xl font-700 text-slate-900">🔤 Phonics Quest</h1>
        <p className="mt-1 font-round font-600 text-slate-600">Travel the worlds and master every sound!</p>
      </div>

      <div className="mt-4 grid gap-3">
        {PHONICS_STAGES.map((stage, i) => {
          const unlocked = isUnlocked(i);
          const a = ACCENTS[stage.accent];
          const earned = stars[stage.id] ?? 0;
          return (
            <button
              key={stage.id}
              onClick={() => unlocked && setSelected(i)}
              disabled={!unlocked}
              className={`flex items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition ${unlocked ? "hover:-translate-y-0.5 hover:shadow-md" : "opacity-60"}`}
            >
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${unlocked ? a.soft : "bg-slate-100"}`}>
                {unlocked ? stage.emoji : "🔒"}
              </div>
              <div className="flex-1">
                <div className={`font-fun font-700 ${unlocked ? "text-slate-900" : "text-slate-400"}`}>
                  World {i + 1} · {stage.title}
                </div>
                <div className="font-round text-sm text-slate-500">{unlocked ? stage.subtitle : "Clear the world before to unlock"}</div>
                {unlocked && (
                  <div className="mt-1">
                    <StarRow filled={earned} size="text-base" />
                  </div>
                )}
              </div>
              {unlocked && <div className={`font-fun text-xl font-700 ${a.text}`}>▶</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
