"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

export type PageRow = {
  id: number;
  slug: string;
  title: string;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  category: string | null;
  categorySlug: string | null;
};

type CategoryOption = { slug: string; name: string };

const STATUSES: PageRow["status"][] = ["draft", "published", "archived"];

const STATUS_CLASS: Record<PageRow["status"], string> = {
  draft: "bg-(--color-amber)/15 text-(--color-amber) border-(--color-amber)/30",
  published: "bg-(--color-green)/15 text-(--color-green) border-(--color-green)/30",
  archived: "bg-white/5 text-white/40 border-white/15",
};

function formatShort(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

export function PagesBulkTable({
  rows,
  categories = [],
  deleteMany,
  updateStatus,
}: {
  rows: PageRow[];
  categories?: CategoryOption[];
  deleteMany: (ids: number[]) => Promise<void>;
  updateStatus: (ids: number[], status: PageRow["status"]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PageRow["status"]>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<
    "updated_desc" | "updated_asc" | "title_asc" | "category_asc"
  >("updated_desc");
  const [page, setPage] = useState(1);
  const [bulkStatus, setBulkStatus] = useState<PageRow["status"]>("archived");
  const [pending, startTransition] = useTransition();
  const PAGE_SIZE = 25;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = needle
      ? rows.filter(
          (p) =>
            p.title.toLowerCase().includes(needle) || p.slug.toLowerCase().includes(needle),
        )
      : [...rows];
    if (statusFilter !== "all") r = r.filter((p) => p.status === statusFilter);
    if (categoryFilter !== "all") {
      r = categoryFilter === "__none__"
        ? r.filter((p) => !p.categorySlug)
        : r.filter((p) => p.categorySlug === categoryFilter);
    }
    r.sort((a, b) => {
      if (sort === "title_asc") return a.title.localeCompare(b.title);
      if (sort === "category_asc") {
        // General first, then other categories A→Z, then uncategorised last.
        const rank = (row: PageRow) => {
          if (row.categorySlug === "general") return [0, ""] as const;
          if (!row.category) return [2, ""] as const;
          return [1, row.category.toLowerCase()] as const;
        };
        const [ra, sa] = rank(a);
        const [rb, sb] = rank(b);
        if (ra !== rb) return ra - rb;
        if (sa !== sb) return sa < sb ? -1 : 1;
        return a.title.localeCompare(b.title);
      }
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      return sort === "updated_desc" ? tb - ta : ta - tb;
    });
    return r;
  }, [rows, q, statusFilter, categoryFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useMemo(() => setPage(1), [q, statusFilter, categoryFilter, sort]);

  const pagedIds = paged.map((p) => p.id);
  const allChecked = pagedIds.length > 0 && pagedIds.every((id) => selected.has(id));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (pagedIds.every((id) => prev.has(id))) {
        const next = new Set(prev);
        for (const id of pagedIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of pagedIds) next.add(id);
      return next;
    });
  }
  function onDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} page${selected.size === 1 ? "" : "s"}? Cannot be undone.`))
      return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await deleteMany(ids);
      setSelected(new Set());
    });
  }
  function onChangeStatus() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await updateStatus(ids, bulkStatus);
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or slug…"
          className="flex-1 min-w-[220px] px-3 py-2 bg-white/5 border border-white/10 rounded text-sm placeholder:text-white/30 focus:outline-none focus:border-(--color-cyan)/40"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm"
        >
          <option value="all">All categories</option>
          <option value="__none__">— Uncategorised —</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm"
        >
          <option value="updated_desc">Newest first</option>
          <option value="updated_asc">Oldest first</option>
          <option value="title_asc">Title A→Z</option>
          <option value="category_asc">Category (General first)</option>
        </select>
        <span className="text-xs text-white/50 font-mono">
          {filtered.length}/{rows.length}
        </span>
      </div>

      {selected.size > 0 && (
        <div className="glass px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-white/70 font-mono">{selected.size} selected</span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as PageRow["status"])}
            className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={onChangeStatus}
            disabled={pending}
            className="px-2 py-1 text-xs border border-white/10 rounded hover:bg-white/5 disabled:opacity-50"
          >
            Set status
          </button>
          <button
            onClick={onDelete}
            disabled={pending}
            className="ml-auto px-2 py-1 text-xs border border-red-500/40 text-red-400 rounded hover:bg-red-500/10 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}

      <div className="glass rounded-xl overflow-x-auto -mr-8">
        <table className="text-sm w-max">
          <thead className="bg-white/5 text-left text-[11px] uppercase text-white/60">
            <tr>
              <th className="px-2 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Select page"
                  className="accent-(--color-cyan)"
                />
              </th>
              <th className="px-3 py-2 whitespace-nowrap">Title</th>
              <th className="px-3 py-2 whitespace-nowrap">Slug</th>
              <th className="px-3 py-2 whitespace-nowrap">Category</th>
              <th className="px-3 py-2 whitespace-nowrap">Status</th>
              <th className="px-3 py-2 whitespace-nowrap">Updated</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => {
              const isSel = selected.has(p.id);
              return (
                <tr
                  key={p.id}
                  className={`border-t border-white/5 hover:bg-white/5 ${isSel ? "bg-(--color-cyan)/5" : ""}`}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(p.id)}
                      aria-label={`Select page ${p.id}`}
                      className="accent-(--color-cyan)"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Link
                      href={`/admin/pages/${p.id}/edit`}
                      className="hover:text-(--color-cyan) whitespace-nowrap leading-snug block"
                      title={p.title}
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-white/60 font-mono text-xs whitespace-nowrap">/{p.slug}</td>
                  <td className="px-3 py-1.5">
                    {p.category ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border bg-(--color-amber)/15 text-(--color-amber) border-(--color-amber)/40 whitespace-nowrap">
                        {p.category}
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/30 font-mono">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border ${STATUS_CLASS[p.status]}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-white/60 text-xs whitespace-nowrap">
                    {formatShort(p.updatedAt)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {p.status === "published" && (
                      <a
                        href={`/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-white/50 hover:text-(--color-cyan) mr-3"
                      >
                        View
                      </a>
                    )}
                    <Link
                      href={`/admin/pages/${p.id}/edit`}
                      className="text-xs text-(--color-cyan) hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/50">
                  {q || statusFilter !== "all"
                    ? "No pages match the current filters."
                    : "No pages yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-3 py-1.5 rounded border border-white/10 bg-white/3 text-xs hover:border-white/30 disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-xs text-white/60 font-mono">
            page {safePage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-3 py-1.5 rounded border border-white/10 bg-white/3 text-xs hover:border-white/30 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
