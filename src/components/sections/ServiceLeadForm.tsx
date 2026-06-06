"use client";

import { useState } from "react";
import { TurnstileWidget } from "@/components/forms/TurnstileWidget";

/**
 * Generic service-page lead form. Mirrors SsgAtoLeadForm but takes a
 * source label so leads are attributable, plus button text overrides.
 */
export function ServiceLeadForm({
  source,
  buttonLabel = "Book my consultation →",
  qualifyingPlaceholder = "Tell us about your goals, team size, timeline…",
  compact = false,
}: {
  source: string;
  buttonLabel?: string;
  qualifyingPlaceholder?: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string>("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, source, turnstileToken }),
      });
      if (!r.ok) throw new Error(await r.text());
      setState("ok");
      setMsg("Thanks — a consultant will be in touch within 1 business day.");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setState("err");
      setMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`glass ${compact ? "p-6 md:p-7" : "p-8 md:p-10"} space-y-5`}
    >
      <div className="grid md:grid-cols-2 gap-5">
        <Input name="name" label="Your name" required />
        <Input name="email" label="Work email" type="email" required />
        <Input name="company" label="Company" required />
        <Input name="phone" label="Phone (Singapore)" />
      </div>
      <div>
        <label className="kicker block mb-2" htmlFor={`${source}-message`}>
          Tell us more
        </label>
        <textarea
          id={`${source}-message`}
          name="message"
          required
          rows={4}
          className="w-full px-4 py-3 rounded-lg bg-white/3 border border-white/10 focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition placeholder:text-white/30"
          placeholder={qualifyingPlaceholder}
        />
      </div>
      <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
        <p className="text-xs text-(--color-muted) font-mono">
          [ Free consultation · reply within 1 business day ]
        </p>
        <button
          type="submit"
          disabled={state === "sending"}
          className="btn-primary disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : buttonLabel}
        </button>
      </div>
      {msg && (
        <p
          className={
            state === "ok"
              ? "text-(--color-green) text-sm font-mono"
              : "text-red-400 text-sm font-mono"
          }
        >
          {msg}
        </p>
      )}
      <TurnstileWidget onToken={setTurnstileToken} />
    </form>
  );
}

function Input({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  const id = `svc-${name}`;
  return (
    <div>
      <label className="kicker block mb-2" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        required={required}
        className="w-full px-4 py-3 rounded-lg bg-white/3 border border-white/10 focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition"
      />
    </div>
  );
}
