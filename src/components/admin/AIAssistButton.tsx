"use client";

import { useEffect, useRef, useState } from "react";

export type AIAssistMode =
  | "generate_full_post"
  | "enhance_post"
  | "generate_blog_draft"
  | "improve_seo"
  | "summarize"
  | "suggest_meta"
  | "rewrite";

type Props = {
  mode: AIAssistMode;
  context: string;
  onResult: (text: string) => void;
  label?: string;
};

// Approximate per-mode wall-time on Sonnet 4.6 (no extended thinking) so we
// can show useful progress hints.
const ETA_SECS: Record<AIAssistMode, number> = {
  generate_full_post: 20,
  enhance_post: 15,
  generate_blog_draft: 12,
  improve_seo: 6,
  summarize: 5,
  suggest_meta: 5,
  rewrite: 7,
};

const STEPS: Record<AIAssistMode, string[]> = {
  generate_full_post: [
    "Sending topic to Claude…",
    "Drafting title and outline…",
    "Writing body in HTML…",
    "Suggesting category and tags…",
    "Finalising — almost done…",
  ],
  enhance_post: [
    "Reading current content…",
    "Applying your instructions…",
    "Inserting links on keywords…",
    "Finalising — almost done…",
  ],
  generate_blog_draft: [
    "Sending prompt to Claude…",
    "Writing draft…",
    "Wrapping up…",
  ],
  improve_seo: ["Rewriting for SEO…", "Polishing…"],
  summarize: ["Summarising…"],
  suggest_meta: ["Generating meta title and description…"],
  rewrite: ["Rewriting…", "Polishing tone…"],
};

export function AIAssistButton({ mode, context, onResult, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number>(0);

  // Tick the elapsed counter and advance the step hint while loading.
  useEffect(() => {
    if (!loading) return;
    startedAt.current = Date.now();
    const steps = STEPS[mode];
    const eta = ETA_SECS[mode];
    const interval = setInterval(() => {
      const secs = Math.round((Date.now() - startedAt.current) / 1000);
      setElapsed(secs);
      // Advance through the step list proportional to elapsed/eta.
      const idx = Math.min(steps.length - 1, Math.floor((secs / eta) * steps.length));
      setStepIdx(idx);
    }, 250);
    return () => clearInterval(interval);
  }, [loading, mode]);

  async function run() {
    setLoading(true);
    setError(null);
    setStepIdx(0);
    setElapsed(0);
    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, context }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { text: string };
      onResult(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const steps = STEPS[mode];
  const eta = ETA_SECS[mode];
  const progress = loading ? Math.min(99, Math.round((elapsed / eta) * 100)) : 0;

  return (
    <div className="inline-flex flex-col items-stretch">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        aria-busy={loading}
        className="relative overflow-hidden px-4 py-2 text-xs rounded bg-gradient-to-r from-(--color-purple) to-(--color-cyan) hover:opacity-90 disabled:opacity-90 disabled:cursor-progress font-medium flex items-center gap-2 justify-center min-w-[180px]"
      >
        {loading && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-white/15 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        )}
        <span className="relative flex items-center gap-2">
          {loading ? (
            <Spinner />
          ) : (
            <span aria-hidden>✨</span>
          )}
          <span>{loading ? `Generating… ${elapsed}s` : `AI ${label ?? "Assist"}`}</span>
        </span>
      </button>
      {loading && (
        <div className="mt-1.5 text-[11px] text-(--color-purple) font-mono">
          → {steps[stepIdx]}
        </div>
      )}
      {error && <span className="text-xs text-red-400 mt-1 max-w-md break-words">{error}</span>}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
