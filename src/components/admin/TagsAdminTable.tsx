"use client";

import { useMemo, useState, useTransition } from "react";

export type TagRow = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

type SortKey = "popular" | "name" | "slug";

export function TagsAdminTable({
  rows,
  remove,
}: {
  rows: TagRow[];
  remove: (id: number) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [pending, startTransition] = useTransition();

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const r = needle
      ? rows.filter(
          (t) =>
            t.name.toLowerCase().includes(needle) || t.slug.toLowerCase().includes(needle),
        )
      : [...rows];
    r.sort((a, b) => {
      if (sort === "popular") return b.count - a.count || a.name.localeCompare(b.name);
      if (sort === "name") return a.name.localeCompare(b.name);
      return a.slug.localeCompare(b.slug);
    });
    return r;
  }, [rows, q, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  // Reset to page 1 when search/sort changes
  useMemo(() => setPage(1), [q, sort]);

  function onDelete(id: number, name: string) {
    if (!confirm(`Delete tag "${name}"? This will also remove it from any posts using it.`)) return;
    startTransition(async () => {
      await remove(id);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tags by name or slug…"
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm placeholder:text-white/30 focus:outline-none focus:border-(--color-cyan)/40"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm"
        >
          <option value="popular">Sort: Popular first</option>
          <option value="name">Sort: Name (A–Z)</option>
          <option value="slug">Sort: Slug (A–Z)</option>
        </select>
        <span className="text-xs text-white/50 font-mono">
          {filtered.length}/{rows.length}
        </span>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-[11px] uppercase text-white/60">
            <tr>
              <th className="px-3 py-2 w-[28%]">Name</th>
              <th className="px-3 py-2 w-[40%]">Slug</th>
              <th className="px-3 py-2 w-[12%] text-right">Posts</th>
              <th className="px-3 py-2 w-[20%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((t) => (
              <tr key={t.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-1.5 font-medium text-white">{t.name}</td>
                <td className="px-3 py-1.5 font-mono text-xs text-white/60">/{t.slug}</td>
                <td className="px-3 py-1.5 text-right">
                  {t.count > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-(--color-cyan)/30 bg-(--color-cyan)/10 text-(--color-cyan) font-mono">
                      {t.count}
                    </span>
                  ) : (
                    <span className="text-xs text-white/30 font-mono">0</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <a
                    href={`/blog?tag=${encodeURIComponent(t.slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/50 hover:text-(--color-cyan) mr-3"
                  >
                    View
                  </a>
                  <button
                    type="button"
                    onClick={() => onDelete(t.id, t.name)}
                    disabled={pending}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-white/50">
                  {q ? `No tags match "${q}".` : "No tags yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-3 py-1.5 rounded border border-white/10 bg-white/3 text-xs hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`px-3 py-1.5 rounded border text-xs font-mono ${
                n === safePage
                  ? "bg-(--color-cyan)/15 border-(--color-cyan)/40 text-(--color-cyan)"
                  : "border-white/10 bg-white/3 text-white/60 hover:border-white/30"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-3 py-1.5 rounded border border-white/10 bg-white/3 text-xs hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
