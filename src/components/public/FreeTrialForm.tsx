"use client";

import { useState } from "react";
import { TurnstileWidget } from "@/components/forms/TurnstileWidget";
import { AGE_BANDS } from "@/lib/portal-content";

/**
 * Public "Book a free trial" form (kids theme). POSTs to /api/free-trial, which
 * stores a lead (source="free-trial"), alerts staff and emails the parent an
 * acknowledgement.
 */
export function FreeTrialForm() {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const r = await fetch("/api/free-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, turnstileToken }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(typeof d.error === "string" ? d.error : "Please check your details and try again.");
      }
      setState("ok");
    } catch (err) {
      setState("err");
      setMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (state === "ok") {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-mint/30">
        <div className="text-6xl">🎉</div>
        <h2 className="mt-3 font-fun text-2xl font-700 text-slate-900">Request received!</h2>
        <p className="mx-auto mt-2 max-w-sm font-round text-slate-600">
          Check your inbox for a confirmation — our team will reach out within 1 business day to book
          your child&apos;s free trial class.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="parentName" required />
        <Field label="Email" name="parentEmail" type="email" required />
        <Field label="Phone" name="parentPhone" type="tel" />
        <Field label="Child's name" name="childName" required />
        <div className="sm:col-span-2">
          <label className="mb-1.5 block font-fun text-sm font-700 text-slate-700">Child&apos;s age</label>
          <select
            name="childAge"
            required
            defaultValue=""
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 font-round text-slate-700 outline-none transition focus:border-sky"
          >
            <option value="" disabled>
              Pick an age group…
            </option>
            {AGE_BANDS.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.emoji} {b.slug} years · {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block font-fun text-sm font-700 text-slate-700">
            Anything we should know? <span className="font-500 text-slate-400">(optional)</span>
          </label>
          <textarea
            name="message"
            rows={4}
            placeholder="Interests, questions, preferred days…"
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 font-round text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-sky"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col items-start gap-3">
        <TurnstileWidget onToken={setTurnstileToken} />
        <button
          type="submit"
          disabled={state === "sending"}
          className="rounded-full bg-coral px-8 py-3 font-fun text-lg font-700 text-white shadow-lg shadow-coral/30 transition hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
        >
          {state === "sending" ? "Sending…" : "Book my free trial 🎉"}
        </button>
        <p className="font-round text-xs text-slate-400">We reply within 1 business day. No spam, ever.</p>
        {state === "err" && msg && <p className="font-round text-sm font-600 text-coral">{msg}</p>}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block font-fun text-sm font-700 text-slate-700">
        {label}
        {!required && <span className="font-500 text-slate-400"> (optional)</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 font-round text-slate-700 outline-none transition focus:border-sky"
      />
    </div>
  );
}
