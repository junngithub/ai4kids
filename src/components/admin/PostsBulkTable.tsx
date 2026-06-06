"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

export type PostRow = {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  createdAt: string; // ISO
  updatedAt: string; // ISO
  category: string | null;
  tags: { name: string; slug: string }[];
  featured?: boolean;
};

type Props = {
  rows: PostRow[];
  deleteMany: (ids: number[]) => Promise<void>;
  setFeatured?: (id: number, featured: boolean) => Promise<void>;
};

function formatShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function PostsBulkTable({ rows, deleteMany, setFeatured }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticFeatured, setOptimisticFeatured] = useState<Record<number, boolean>>({});

  function toggleFeatured(id: number, current: boolean) {
    if (!setFeatured) return;
    setOptimisticFeatured((prev) => ({ ...prev, [id]: !current }));
    startTransition(async () => {
      await setFeatured(id, !current);
    });
  }

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someChecked = rows.some((r) => selected.has(r.id)) && !allChecked;

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onDelete() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const ok = window.confirm(
      `Delete ${ids.length} post${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteMany(ids);
        setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="mb-2 flex items-center justify-between px-3 py-2 rounded-lg border border-(--color-purple)/30 bg-(--color-purple)/10 text-sm">
          <span className="font-mono text-(--color-purple)">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="px-3 py-1 text-xs rounded border border-white/10 hover:bg-white/5"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="px-3 py-1 text-xs rounded bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 text-red-200 disabled:opacity-50"
            >
              {pending ? "Deleting…" : `Delete ${selected.size}`}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="mb-2 text-xs text-red-400 px-3 py-2 rounded border border-red-500/30 bg-red-500/5">
          {error}
        </p>
      )}
      <div className="glass rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm whitespace-nowrap">
          <thead className="bg-white/5 text-left text-[11px] uppercase tracking-wider text-white/60">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="accent-(--color-cyan) cursor-pointer w-4 h-4 align-middle"
                />
              </th>
              <th className="px-3 py-2 w-8" title="Featured">★</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Tags</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-white/5 hover:bg-white/5 leading-tight">
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    aria-label={`Select ${p.title}`}
                    className="accent-(--color-cyan) cursor-pointer w-4 h-4 align-middle"
                  />
                </td>
                <td className="px-3 py-1.5">
                  {(() => {
                    const current =
                      optimisticFeatured[p.id] !== undefined
                        ? optimisticFeatured[p.id]
                        : p.featured ?? false;
                    return (
                      <button
                        type="button"
                        onClick={() => toggleFeatured(p.id, current)}
                        disabled={!setFeatured || pending}
                        title={current ? "Unfeature this post" : "Feature this post on homepage"}
                        className={`text-base leading-none transition ${
                          current ? "text-(--color-amber)" : "text-white/20 hover:text-white/60"
                        } disabled:opacity-50`}
                      >
                        {current ? "★" : "☆"}
                      </button>
                    );
                  })()}
                </td>
                <td className="px-3 py-1.5 max-w-[420px] truncate">
                  <Link className="hover:text-(--color-cyan)" href={`/admin/posts/${p.id}/edit`} title={p.title}>
                    {p.title}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-white/60 font-mono text-xs max-w-[260px] truncate" title={p.slug}>
                  {p.slug}
                </td>
                <td className="px-3 py-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                      p.status === "published"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : p.status === "draft"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-white/10 text-white/60"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-white/70">
                  {p.category ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-400/10 text-yellow-300 border border-yellow-400/30">
                      {p.category}
                    </span>
                  ) : (
                    <span className="text-white/30 text-xs">—</span>
                  )}
                </td>
                <td
                  className="px-3 py-1.5 max-w-[260px] truncate"
                  title={p.tags.map((t) => t.name).join(", ")}
                >
                  {p.tags.length === 0 ? (
                    <span className="text-white/30 text-xs">—</span>
                  ) : (
                    <span className="text-white/70 text-xs">
                      {p.tags.map((t) => t.name).join(", ")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-white/60 text-xs">
                  {formatShort(p.createdAt)}
                </td>
                <td className="px-3 py-1.5 text-white/60 text-xs">
                  {formatShort(p.updatedAt)}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <div className="inline-flex items-center gap-1">
                    {p.status === "published" ? (
                      <a
                        href={`/blog/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 text-xs rounded border border-white/10 hover:border-(--color-cyan)/60 hover:text-(--color-cyan) hover:bg-(--color-cyan)/5 transition"
                        title="Open public post in a new tab"
                      >
                        View
                      </a>
                    ) : (
                      <span
                        className="px-2 py-1 text-xs rounded border border-white/5 text-white/30 cursor-not-allowed"
                        title="Only published posts have a public URL"
                      >
                        View
                      </span>
                    )}
                    <Link
                      href={`/admin/posts/${p.id}/edit`}
                      className="px-2 py-1 text-xs rounded border border-(--color-cyan)/40 text-(--color-cyan) hover:bg-(--color-cyan)/10 transition"
                      title="Edit this post"
                    >
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-white/50">
                  No posts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
