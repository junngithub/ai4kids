"use client";

import { useState, useTransition } from "react";

type Props = {
  enabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
};

export function AutoPublishToggle({ enabled, onToggle }: Props) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function flip() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      await onToggle(next);
    });
  }

  return (
    <div
      className={`glass p-4 mb-6 flex items-center justify-between gap-4 flex-wrap border ${
        on ? "border-(--color-green)/40" : "border-white/10"
      }`}
    >
      <div className="flex-1 min-w-[280px]">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold">
            Auto-publish on blog publish
          </span>
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
              on
                ? "bg-(--color-green)/15 text-(--color-green) border-(--color-green)/30"
                : "bg-white/5 text-white/50 border-white/15"
            }`}
          >
            {on ? "ON" : "OFF"}
          </span>
        </div>
        <p className="text-xs text-(--color-muted) mt-1">
          When ON, publishing a blog post immediately fires LinkedIn + Facebook
          posts with the auto-generated copy — no review step. When OFF,
          drafts queue here for editing/scheduling.
        </p>
      </div>
      <button
        type="button"
        onClick={flip}
        disabled={pending}
        role="switch"
        aria-checked={on}
        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition disabled:opacity-50 ${
          on
            ? "bg-(--color-green)/30 border-(--color-green)/50"
            : "bg-white/5 border-white/15"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white transition ${
            on ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
