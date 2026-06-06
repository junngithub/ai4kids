"use client";

import { useState } from "react";
import { Container } from "@/components/layout/Container";
import { TurnstileWidget } from "@/components/forms/TurnstileWidget";

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string>("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries()) as Record<string, string>;
    const preferred = (payload.preferredDemo || "").trim();
    delete payload.preferredDemo;
    const message = preferred
      ? `Preferred demo slot: ${formatPreferred(preferred)}\n\n${payload.message ?? ""}`
      : payload.message;
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, message, source: "home", turnstileToken }),
      });
      if (!r.ok) throw new Error(await r.text());
      setState("ok");
      setMsg("Thanks — we'll be in touch shortly.");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setState("err");
      setMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <section id="contact" className="relative py-4 overflow-hidden">
      <div className="glow-blob" style={{ top: "10%", right: "0", width: 480, height: 480, background: "radial-gradient(circle, #5C00E5 0%, transparent 70%)" }} />
      <Container className="max-w-4xl relative">
        <div className="text-center mb-6">
          <div className="kicker mb-4">[ GET IN TOUCH ]</div>
          <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[1.05] mb-4">
            Talk to <span className="gradient-text">us</span>.
          </h2>
          <p className="text-(--color-muted) text-lg">
            Tell us about your training program or AI project. We respond within one business day.
          </p>
        </div>
        <form onSubmit={onSubmit} className="glass p-8 md:p-10 space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            <Input name="name" label="Your name" required />
            <Input name="email" label="Email" type="email" required />
            <Input name="company" label="Company" required />
            <Input name="phone" label="Phone" />
          </div>
          <div>
            <label className="kicker block mb-2">
              Preferred date & time for demo <span className="text-(--color-muted) normal-case">(optional)</span>
            </label>
            <input
              type="datetime-local"
              name="preferredDemo"
              className="w-full px-4 py-3 rounded-lg bg-white/3 border border-white/10 focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-white [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="kicker block mb-2">Your message</label>
            <textarea
              name="message"
              required
              rows={5}
              className="w-full px-4 py-3 rounded-lg bg-white/3 border border-white/10 focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition placeholder:text-white/30"
              placeholder="Tell us about your training program or AI initiative…"
            />
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
            <p className="text-xs text-(--color-muted) font-mono">
              [ We reply within 1 business day ]
            </p>
            <button type="submit" disabled={state === "sending"} className="btn-primary disabled:opacity-60">
              {state === "sending" ? "Sending…" : "Send inquiry →"}
            </button>
          </div>
          {msg && (
            <p className={state === "ok" ? "text-(--color-green) text-sm font-mono" : "text-red-400 text-sm font-mono"}>
              {msg}
            </p>
          )}
          <TurnstileWidget onToken={setTurnstileToken} />
        </form>
      </Container>
    </section>
  );
}

function formatPreferred(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-SG", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
  return (
    <div>
      <label className="kicker block mb-2">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        className="w-full px-4 py-3 rounded-lg bg-white/3 border border-white/10 focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition"
      />
    </div>
  );
}
