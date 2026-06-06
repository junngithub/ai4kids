"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Round = { word: string; emoji: string; options: string[]; answerIndex: number };

export default function PhonicsPage() {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/learn/phonics")
      .then((r) => r.json())
      .then((d) => setRounds(d.rounds))
      .catch(() => setRounds([]));
  }, []);

  const speak = useCallback((word: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(word);
    u.rate = 0.8;
    u.pitch = 1.2;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  const round = rounds?.[idx];

  // Speak the word when a new round appears.
  useEffect(() => {
    if (round) speak(round.word);
  }, [round, speak]);

  function pick(i: number) {
    if (picked != null || !round) return;
    setPicked(i);
    const isRight = i === round.answerIndex;
    if (isRight) setCorrect((c) => c + 1);
    setTimeout(() => {
      if (idx + 1 < (rounds?.length ?? 0)) {
        setIdx(idx + 1);
        setPicked(null);
      } else {
        finish(isRight ? correct + 1 : correct);
      }
    }, 900);
  }

  async function finish(finalCorrect: number) {
    setDone(true);
    const total = rounds?.length ?? 1;
    const score = Math.round((finalCorrect / total) * 100);
    try {
      const res = await fetch("/api/learn/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activitySlug: "ai-phonics",
          score,
          metadata: { correct: finalCorrect, total },
        }),
      });
      const d = await res.json();
      setSaved(score);
    } catch {
      setSaved(score);
    }
  }

  if (rounds === null) {
    return <div className="text-center font-fun text-slate-500">Loading your word game… 🔤</div>;
  }

  return (
    <div>
      <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to activities</Link>

      {!done && round ? (
        <div className="mt-3 rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-mint/30">
          <div className="font-fun text-sm font-600 text-slate-400">
            Word {idx + 1} of {rounds.length}
          </div>
          <div className="mt-4 text-8xl">{round.emoji}</div>
          <button
            onClick={() => speak(round.word)}
            className="mt-4 rounded-full bg-sky-500 px-6 py-2 font-fun font-700 text-white shadow"
          >
            🔊 Hear the word
          </button>
          <p className="mt-4 font-round text-slate-500">Which word matches the picture?</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {round.options.map((opt, i) => {
              const isAnswer = i === round.answerIndex;
              const show = picked != null;
              const cls = show
                ? isAnswer
                  ? "bg-mint/30 text-emerald-700 ring-emerald-300"
                  : i === picked
                    ? "bg-coral/20 text-coral ring-coral/40"
                    : "bg-amber-50 text-slate-400 ring-amber-100"
                : "bg-amber-50 text-slate-700 ring-amber-100 hover:bg-amber-100";
              return (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  className={`rounded-2xl px-4 py-4 font-fun text-2xl font-700 ring-2 transition ${cls}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-amber-100">
          <div className="text-7xl">🎉</div>
          <h2 className="mt-3 font-fun text-3xl font-700 text-slate-900">Great reading!</h2>
          <p className="mt-1 font-round text-slate-500">
            You got {correct} of {rounds.length} right.
          </p>
          {saved != null && (
            <div className="mt-3 inline-block rounded-full bg-mint/20 px-4 py-1 font-fun font-700 text-emerald-600">
              +{saved} points!
            </div>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => location.reload()}
              className="rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow"
            >
              Play again 🔁
            </button>
            <Link href="/learn" className="rounded-full bg-slate-100 px-6 py-3 font-fun font-600 text-slate-600">
              All activities
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
