"use client";

import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: string | HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          appearance?: "always" | "execute" | "interaction-only";
          size?: "normal" | "compact" | "flexible" | "invisible";
          retry?: "auto" | "never";
        },
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;
let siteKeyPromise: Promise<string | null> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile-script-failed"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function fetchSiteKey(): Promise<string | null> {
  if (siteKeyPromise) return siteKeyPromise;
  siteKeyPromise = fetch("/api/turnstile/site-key")
    .then((r) => r.json())
    .then((d: { siteKey: string | null }) => d.siteKey ?? null)
    .catch(() => null);
  return siteKeyPromise;
}

/**
 * Invisible Cloudflare Turnstile. When verification succeeds, calls onToken
 * with the response token — caller must include it in the form payload as
 * `turnstileToken`. When Turnstile isn't configured, calls onToken("") on mount
 * so submission is not blocked.
 */
export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const containerId = useId().replace(/:/g, "_");
  const widgetIdRef = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchSiteKey().then((k) => {
      if (!mounted) return;
      if (!k) {
        onToken("");
        return;
      }
      setSiteKey(k);
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        const el = document.getElementById(containerId);
        if (!el) return;
        widgetIdRef.current = window.turnstile.render(el, {
          sitekey: siteKey,
          size: "invisible",
          appearance: "interaction-only",
          retry: "auto",
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => {
        // If the script fails to load, don't block submission.
        onToken("");
      });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  // Empty placeholder div — Turnstile renders into it. Invisible widget keeps
  // it zero-height, but we still want it in the DOM tree for the bot challenge.
  return <div id={containerId} aria-hidden="true" />;
}
