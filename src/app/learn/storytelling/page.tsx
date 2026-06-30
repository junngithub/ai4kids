"use client";

import { useState } from "react";
import Link from "next/link";

type Story = { title: string; scenes: { text: string; emojis: string; image?: string }[] };

const IDEAS = [
  "a dragon who is afraid of fire",
  "a robot learning to paint",
  "a cat astronaut on the moon",
  "a magical treehouse",
];

export default function StorytellingPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<Story | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setStory(null);
    setScore(null);
    try {
      const res = await fetch("/api/learn/storytelling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStory(data.story);
      setScore(data.score);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Oops, try again!");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to activities</Link>
      <div className="mt-3 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-coral/30">
        <h1 className="font-fun text-3xl font-700 text-slate-900">📖 AI Storytelling</h1>
        <p className="mt-1 font-round text-slate-500">Tell the AI what your story is about and watch it come to life!</p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="My story is about…"
          className="mt-4 w-full rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-3 font-round text-lg outline-none focus:border-coral"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {IDEAS.map((i) => (
            <button
              key={i}
              onClick={() => setPrompt(i)}
              className="rounded-full bg-amber-50 px-3 py-1 text-sm font-600 text-slate-500 ring-1 ring-amber-100 hover:bg-amber-100"
            >
              ✨ {i}
            </button>
          ))}
        </div>
        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          className="mt-4 rounded-full bg-coral px-8 py-3 font-fun text-lg font-700 text-white shadow-lg shadow-coral/30 transition hover:scale-105 disabled:opacity-60"
        >
          {loading ? "Dreaming up your story… ✨" : "Make my story! 🪄"}
        </button>
        {error && <p className="mt-3 text-coral">{error}</p>}
      </div>

      {story && (
        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-amber-100">
          {score != null && (
            <div className="mb-4 inline-block rounded-full bg-mint/20 px-4 py-1 font-fun font-700 text-emerald-600">
              +{score} points earned! 🎉
            </div>
          )}
          <h2 className="font-fun text-2xl font-700 text-slate-900">{story.title}</h2>
          <div className="mt-4 space-y-5">
            {story.scenes.map((s, i) => (
              <div key={i} className="rounded-2xl bg-gradient-to-r from-amber-50 to-white p-5 ring-1 ring-amber-100">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt={s.text} className="w-full rounded-xl ring-1 ring-amber-100" />
                ) : (
                  <div className="text-5xl">{s.emojis}</div>
                )}
                <p className="mt-2 font-round text-lg text-slate-700">{s.text}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setStory(null); setPrompt(""); }}
            className="mt-6 rounded-full bg-sky-500 px-6 py-3 font-fun font-700 text-white shadow"
          >
            Write another! ✏️
          </button>
        </div>
      )}
    </div>
  );
}
