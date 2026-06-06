"use client";

import { useState } from "react";

export function MediaUploader() {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      setMsg("Uploaded — reload page to view");
      window.location.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="glass rounded-xl p-4">
      <label className="cursor-pointer flex items-center gap-3">
        <span className="px-4 py-2 rounded bg-neon-blue/30 border border-neon-blue/50 text-sm">
          {uploading ? "Uploading…" : "Upload image"}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onChange}
          disabled={uploading}
        />
        {msg && <span className="text-xs text-white/70">{msg}</span>}
      </label>
    </div>
  );
}
