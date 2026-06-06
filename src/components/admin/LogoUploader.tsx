"use client";

import { useRef, useState } from "react";

/**
 * Logo upload widget for /admin/settings/company.
 *
 * Posts the picked file to /api/upload?as-logo=1, which writes the file to
 * /public/uploads/ AND copies it to /public/icon.png so Next.js auto-serves
 * it as the site favicon. On success, the hidden input value is updated so
 * the surrounding <form> persists the URL to settings.company_logo_url.
 */
export function LogoUploader({
  name,
  initialValue,
}: {
  name: string;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload?as-logo=1", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { media: { path: string } };
      setValue(json.media.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center overflow-hidden">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Logo preview" className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-[10px] font-mono text-white/40">NO LOGO</span>
          )}
        </div>
        <div className="flex-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={onPick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-lg border border-(--color-cyan)/40 text-(--color-cyan) text-sm hover:bg-(--color-cyan)/10 transition disabled:opacity-50"
          >
            {uploading ? "Uploading…" : value ? "Replace logo" : "Upload logo"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="ml-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 transition"
            >
              Remove
            </button>
          )}
          <p className="text-[11px] text-(--color-muted) mt-1.5">
            PNG / SVG / JPEG / WebP. Uploaded files are also copied to{" "}
            <code className="text-(--color-cyan)">/public/icon.png</code> so the browser favicon
            auto-updates.
          </p>
        </div>
      </div>
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
      {value && (
        <p className="text-[11px] text-(--color-muted) font-mono break-all">
          URL: <code className="text-(--color-cyan)">{value}</code>
        </p>
      )}
    </div>
  );
}
