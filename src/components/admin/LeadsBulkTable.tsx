"use client";

import { useState, useTransition } from "react";

export type LeadRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: "new" | "follow_up" | "contacted" | "qualified" | "converted" | "lost";
  score: number | null;
  createdAt: string;
};

function scoreClass(score: number | null): string {
  if (score === null) return "bg-white/5 text-white/40 border-white/15";
  if (score <= 3) return "bg-red-500/15 text-red-300 border-red-500/30";
  if (score <= 7) return "bg-(--color-amber)/15 text-(--color-amber) border-(--color-amber)/30";
  return "bg-(--color-green)/15 text-(--color-green) border-(--color-green)/30";
}

function scoreLabel(score: number | null): string {
  if (score === null) return "—";
  if (score <= 3) return `${score} · low`;
  if (score <= 7) return `${score} · warm`;
  return `${score} · hot`;
}

const STATUSES: LeadRow["status"][] = ["new", "follow_up", "contacted", "qualified", "converted", "lost"];

const STATUS_CLASS: Record<LeadRow["status"], string> = {
  new: "bg-(--color-cyan)/15 text-(--color-cyan) border-(--color-cyan)/30",
  follow_up: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  contacted: "bg-(--color-amber)/15 text-(--color-amber) border-(--color-amber)/30",
  qualified: "bg-(--color-purple)/15 text-(--color-purple-light) border-(--color-purple)/30",
  converted: "bg-(--color-green)/15 text-(--color-green) border-(--color-green)/30",
  lost: "bg-white/5 text-white/40 border-white/15",
};

function formatShort(s: string) {
  const d = new Date(s);
  return d.toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function LeadsBulkTable({
  rows,
  deleteMany,
  updateStatus,
}: {
  rows: LeadRow[];
  deleteMany: (ids: number[]) => Promise<void>;
  updateStatus: (ids: number[], status: LeadRow["status"]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<LeadRow["status"]>("contacted");
  const [pending, startTransition] = useTransition();

  const allChecked = rows.length > 0 && selected.size === rows.length;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  function onDelete() {
    if (selected.size === 0) return;
    const count = selected.size;
    if (!confirm(`Delete ${count} lead${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
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
      {selected.size > 0 && (
        <div className="glass px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-white/70 font-mono">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as LeadRow["status"])}
              className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onChangeStatus}
              disabled={pending}
              className="px-2 py-1 text-xs border border-white/10 rounded hover:bg-white/5 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Set status"}
            </button>
          </div>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="px-2 py-1 text-xs border border-red-500/40 text-red-400 rounded hover:bg-red-500/10 disabled:opacity-50 ml-auto"
          >
            Delete selected
          </button>
        </div>
      )}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-white/5 text-left text-[11px] uppercase text-white/60">
            <tr>
              <th className="px-2 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="accent-(--color-cyan)"
                />
              </th>
              <th className="px-2 py-2 w-[14%]">Name</th>
              <th className="px-2 py-2 w-[18%]">Email</th>
              <th className="px-2 py-2 w-[10%]">Tel</th>
              <th className="px-2 py-2 w-[14%]">Company</th>
              <th className="px-2 py-2 w-[11%]">Source</th>
              <th className="px-2 py-2 w-[9%]">Score</th>
              <th className="px-2 py-2 w-[9%]">Status</th>
              <th className="px-2 py-2 w-[12%]">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const isSel = selected.has(l.id);
              return (
                <tr
                  key={l.id}
                  className={`border-t border-white/5 hover:bg-white/5 ${isSel ? "bg-(--color-cyan)/5" : ""}`}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(l.id)}
                      aria-label={`Select lead ${l.id}`}
                      className="accent-(--color-cyan)"
                    />
                  </td>
                  <td className="px-2 py-1.5 truncate" title={l.name}>
                    {l.name}
                  </td>
                  <td className="px-2 py-1.5 truncate">
                    <a
                      href={`mailto:${l.email}`}
                      className="text-(--color-cyan) hover:underline"
                      title={l.email}
                    >
                      {l.email}
                    </a>
                  </td>
                  <td className="px-2 py-1.5 truncate font-mono text-xs text-white/70" title={l.phone ?? ""}>
                    {l.phone ? (
                      <a href={`tel:${l.phone}`} className="hover:underline">
                        {l.phone}
                      </a>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 truncate text-white/80" title={l.company ?? ""}>
                    {l.company ?? <span className="text-white/30">—</span>}
                  </td>
                  <td className="px-2 py-1.5 truncate font-mono text-xs text-white/60">
                    {l.source ?? <span className="text-white/30">—</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border ${scoreClass(l.score)}`}
                      title={l.score === null ? "Not scored" : `Lead score ${l.score}/10`}
                    >
                      {scoreLabel(l.score)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border ${STATUS_CLASS[l.status]}`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-white/60 text-xs whitespace-nowrap">
                    {formatShort(l.createdAt)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-white/50">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
