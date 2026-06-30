"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Small trash button on a gallery picture — deletes the learner's own artwork. */
export function DeleteArtButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("Delete this picture? This can't be undone.")) return;
    setBusy(true);
    const res = await fetch(`/api/learn/art/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      setBusy(false);
      alert("Couldn't delete that picture — please try again.");
    }
  }

  return (
    <button
      onClick={del}
      disabled={busy}
      aria-label="Delete picture"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-base shadow ring-1 ring-black/5 backdrop-blur transition hover:bg-white hover:scale-105 disabled:opacity-50"
    >
      {busy ? "⏳" : "🗑️"}
    </button>
  );
}
