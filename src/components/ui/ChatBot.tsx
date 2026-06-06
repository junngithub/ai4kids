"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { HiChatBubbleLeftRight, HiXMark, HiPaperAirplane } from "react-icons/hi2";

type Msg = { role: "user" | "model"; content: string };

export function ChatBot() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Msg[]>([
    { role: "model", content: "Hi there! I'm Nemo, an AI assistant for Tertiary Infotech Academy. Ask me about our SSG service, LMS, TMS, AI solutions, or anything else — happy to help." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, open]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const next: Msg[] = [...history, { role: "user", content: text }];
    setHistory(next);
    setInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: next.slice(0, -1) }),
      });
      const data = (await res.json()) as { response?: string; error?: string };
      setHistory((h) => [
        ...h,
        { role: "model", content: data.response ?? data.error ?? "Sorry, something went wrong." },
      ]);
    } catch {
      setHistory((h) => [...h, { role: "model", content: "Network error — please try again." }]);
    } finally {
      setSending(false);
    }
  }

  // Chatbot is a customer-facing widget — never render on /admin pages.
  if (pathname?.startsWith("/admin")) return null;
  // Hide on mobile — the floating widget covers content and isn't useful on
  // small viewports. md (≥ 768px) and up only.

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-neon-blue to-neon-purple shadow-[var(--shadow-glow-blue-lg)] hidden md:flex items-center justify-center hover:scale-105 transition"
      >
        {open ? <HiXMark className="w-6 h-6" /> : <HiChatBubbleLeftRight className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[min(92vw,380px)] h-[min(70vh,520px)] glass rounded-2xl hidden md:flex flex-col overflow-hidden border border-white/15">
          <header className="px-4 py-3 border-b border-white/10">
            <h3 className="font-bold">Nemo</h3>
            <p className="text-xs text-white/60">Powered by Claude Agent SDK</p>
          </header>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {history.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-3 py-2 rounded-2xl ${
                  m.role === "user"
                    ? "ml-auto bg-neon-blue/30 border border-neon-blue/40"
                    : "bg-white/5 border border-white/10"
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="bg-white/5 border border-white/10 max-w-[85%] px-3 py-2 rounded-2xl text-white/60">
                Thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-white/10 p-2 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 px-3 py-2 rounded bg-white/5 border border-white/10 focus:outline-none focus:border-neon-blue text-sm"
            />
            <button
              type="submit"
              disabled={sending}
              className="px-3 rounded bg-neon-blue/30 border border-neon-blue/50 hover:bg-neon-blue/40 disabled:opacity-50"
              aria-label="Send"
            >
              <HiPaperAirplane className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
