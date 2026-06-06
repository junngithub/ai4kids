"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * Saved-confirmation toast. Reads `?saved=1` from the URL (set by server
 * actions after a successful write) and shows a prominent, longer-lived
 * banner. Disappears after 4s; the `?saved=1` query is cleaned up afterward
 * so a reload doesn't re-trigger it.
 */
export function SavedToast({ message = "Saved successfully" }: { message?: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (params.get("saved") !== "1") return;
    setVisible(true);
    const hideAt = setTimeout(() => setVisible(false), 4000);
    const cleanAt = setTimeout(() => {
      router.replace(pathname, { scroll: false });
    }, 4300);
    return () => {
      clearTimeout(hideAt);
      clearTimeout(cleanAt);
    };
  }, [params, pathname, router]);

  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border border-(--color-green)/50 bg-(--color-green)/15 text-white shadow-[0_10px_40px_rgba(1,201,130,0.35)] backdrop-blur-md transition animate-in fade-in slide-in-from-top-2"
    >
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-(--color-green) text-(--color-bg) font-bold">
        ✓
      </span>
      <div>
        <div className="font-display font-semibold text-sm">{message}</div>
        <div className="text-xs text-white/60 font-mono">Changes are live</div>
      </div>
    </div>
  );
}
