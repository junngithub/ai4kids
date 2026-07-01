"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  HEROES,
  PLACES,
  OBJECTS,
  MOODS,
  buildStory,
  type Choice,
  type Story,
} from "@/lib/story-builder/templates";

const randIndex = (n: number) => Math.floor(Math.random() * n);

export default function StoryBuilderPage() {
  const [hero, setHero] = useState<number | null>(null);
  const [place, setPlace] = useState<number | null>(null);
  const [obj, setObj] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);

  const [story, setStory] = useState<Story | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [picked, setPicked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // Lazy per-page illustrations: undefined = not fetched, null = none/failed.
  const [images, setImages] = useState<Record<number, string | null>>({});
  const [imgBusy, setImgBusy] = useState(false);
  const requested = useRef<Set<number>>(new Set());

  const ready = hero != null && place != null && obj != null && mood != null;
  const heroC = hero != null ? HEROES[hero] : null;
  const placeC = place != null ? PLACES[place] : null;
  const objC = obj != null ? OBJECTS[obj] : null;

  const atChoice = story != null && !picked && pageIndex === story.pre.length;
  const pageCount = story
    ? picked
      ? pages.length
      : story.pre.length + 1 + story.choiceA.pages.length
    : 0;

  function reset() {
    setStory(null);
    setPages([]);
    setPageIndex(0);
    setPicked(false);
    setCelebrate(false);
    setImages({});
    requested.current = new Set();
    setHero(null);
    setPlace(null);
    setObj(null);
    setMood(null);
  }

  function showStory(s: Story) {
    setStory(s);
    setPages([...s.pre, s.problem]);
    setPageIndex(0);
    setPicked(false);
    setImages({});
    requested.current = new Set();
  }

  const makeStory = useCallback(async (h: number, p: number, o: number, m: number) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/learn/story-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero: h, place: p, object: o, mood: m }),
      });
      const d = await res.json();
      if (d.story) showStory(d.story as Story);
      else showStory(buildStory(HEROES[h], PLACES[p], OBJECTS[o], MOODS[m]));
    } catch {
      showStory(buildStory(HEROES[h], PLACES[p], OBJECTS[o], MOODS[m]));
    } finally {
      setGenerating(false);
    }
  }, []);

  function surprise() {
    const h = randIndex(HEROES.length);
    const p = randIndex(PLACES.length);
    const o = randIndex(OBJECTS.length);
    const m = randIndex(MOODS.length);
    setHero(h);
    setPlace(p);
    setObj(o);
    setMood(m);
    makeStory(h, p, o, m);
  }

  function choose(useA: boolean) {
    if (!story) return;
    const branch = useA ? story.choiceA : story.choiceB;
    setPages([...story.pre, story.problem, ...branch.pages]);
    setPicked(true);
    setPageIndex((i) => i + 1);
  }

  function nextPage() {
    if (pageIndex < pages.length - 1) {
      setPageIndex((i) => i + 1);
    } else {
      fetch("/api/learn/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activitySlug: "ai-story-builder", score: 60, metadata: { pages: pages.length } }),
      }).catch(() => {});
      setCelebrate(true);
    }
  }

  // Fetch the current page's illustration once (skip the fork/problem page).
  useEffect(() => {
    if (pages.length === 0) return;
    const idx = pageIndex;
    if (atChoice) return;
    if (requested.current.has(idx)) return;
    requested.current.add(idx);
    const text = pages[idx];
    setImgBusy(true);
    fetch("/api/learn/story-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((r) => r.json())
      .then((d) => setImages((m) => ({ ...m, [idx]: (d.url as string | null) ?? null })))
      .catch(() => setImages((m) => ({ ...m, [idx]: null })))
      .finally(() => setImgBusy(false));
  }, [pageIndex, pages, atChoice]);

  const img = images[pageIndex];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
        ← Back to activities
      </Link>

      {/* ---------------- Writing ---------------- */}
      {generating ? (
        <div className="mt-3 flex min-h-[24rem] flex-col items-center justify-center gap-4 rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-grape/30">
          <div className="animate-pulse text-6xl">✨📖✨</div>
          <p className="font-fun text-xl font-700 text-slate-800">Writing your story…</p>
        </div>
      ) : pages.length === 0 ? (
        /* ---------------- Picker ---------------- */
        <div className="mt-3 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-grape/30">
          <h1 className="font-fun text-3xl font-700 text-slate-900">📖 Story Builder</h1>
          <p className="mt-1 font-round font-600 text-slate-500">Pick your ingredients and I&apos;ll weave a story!</p>

          <ChoiceRow title="Pick your hero" items={HEROES} selected={hero} onSelect={setHero} />
          <ChoiceRow title="Pick a place" items={PLACES} selected={place} onSelect={setPlace} />
          <ChoiceRow title="Pick a magic item" items={OBJECTS} selected={obj} onSelect={setObj} />
          <ChoiceRow title="Pick a mood" items={MOODS} selected={mood} onSelect={setMood} />

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => ready && makeStory(hero!, place!, obj!, mood!)}
              disabled={!ready}
              className="w-full rounded-full bg-coral py-3 font-fun text-lg font-700 text-white shadow-lg shadow-coral/30 transition hover:scale-[1.02] disabled:opacity-40"
            >
              ✨ Make my story!
            </button>
            <button onClick={surprise} className="w-full rounded-full bg-grape py-3 font-fun font-700 text-white shadow transition hover:scale-[1.02]">
              🎲 Surprise me!
            </button>
          </div>
        </div>
      ) : celebrate ? (
        /* ---------------- Celebration ---------------- */
        <div className="mt-3 rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-amber-100">
          <div className="text-7xl">🎉</div>
          <h2 className="mt-3 font-fun text-3xl font-700 text-slate-900">What a story! ⭐⭐⭐</h2>
          <p className="mt-1 font-round text-slate-500">You earned +60 points!</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={reset} className="rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow">
              Tell another 🔁
            </button>
            <Link href="/learn" className="rounded-full bg-slate-100 px-6 py-3 font-fun font-600 text-slate-600">
              All activities
            </Link>
          </div>
        </div>
      ) : (
        /* ---------------- Reader ---------------- */
        <div className="mt-3 flex flex-col items-center gap-5 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-grape/30">
          {/* Illustration (falls back to the emoji trio while loading or if none) */}
          <div className="flex min-h-[9rem] w-full items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-100">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="Story illustration" className="max-h-72 w-full object-cover" />
            ) : (
              <div className={`py-6 text-6xl ${imgBusy && !atChoice ? "animate-pulse" : ""}`}>
                {heroC?.emoji}
                {placeC?.emoji}
                {objC?.emoji}
              </div>
            )}
          </div>

          <p className="min-h-[5rem] whitespace-pre-line text-center font-round text-xl font-600 text-slate-700">
            {pages[pageIndex]}
          </p>

          {atChoice && story ? (
            <div className="flex w-full flex-col gap-3">
              <button onClick={() => choose(true)} className="w-full rounded-full bg-grape py-3 font-fun font-700 text-white shadow transition hover:scale-[1.02]">
                {story.choiceA.emoji} {story.choiceA.label}
              </button>
              <button onClick={() => choose(false)} className="w-full rounded-full bg-sky-500 py-3 font-fun font-700 text-white shadow transition hover:scale-[1.02]">
                {story.choiceB.emoji} {story.choiceB.label}
              </button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between">
              <span className="font-round text-sm font-600 text-slate-400">
                Page {pageIndex + 1} of {pageCount}
              </span>
              <button onClick={nextPage} className="rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105">
                {pageIndex === pages.length - 1 ? "The End! 🎉" : "Next ▶"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChoiceRow({ title, items, selected, onSelect }: { title: string; items: Choice[]; selected: number | null; onSelect: (i: number) => void }) {
  return (
    <div className="mt-5">
      <p className="font-fun font-700 text-slate-800">{title}</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {items.map((item, i) => {
          const on = selected === i;
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`flex flex-col items-center gap-1 rounded-2xl p-3 ring-1 transition ${
                on ? "scale-[1.03] bg-coral/15 ring-2 ring-coral/50" : "bg-white ring-slate-100 hover:bg-amber-50"
              }`}
            >
              <span className="text-3xl">{item.emoji}</span>
              <span className="font-fun text-xs font-700 text-slate-600">{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
