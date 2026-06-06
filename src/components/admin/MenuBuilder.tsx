"use client";

import { useState, useTransition } from "react";

export type MenuItem = {
  id: number;
  label: string;
  href: string;
  parentId: number | null;
  sortOrder: number;
};

type Props = {
  menuId: number;
  items: MenuItem[];
  saveOrder: (
    menuId: number,
    order: { id: number; parentId: number | null; sortOrder: number }[],
  ) => Promise<void>;
  addItem: (formData: FormData) => Promise<void>;
  deleteItem: (formData: FormData) => Promise<void>;
};

export function MenuBuilder({ menuId, items: initialItems, saveOrder, addItem, deleteItem }: Props) {
  const [items, setItems] = useState<MenuItem[]>(() => sortItems(initialItems));
  const [dragId, setDragId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  function onDragStart(id: number, e: React.DragEvent) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(targetId: number) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    setItems((prev) => {
      const dragIdx = prev.findIndex((i) => i.id === dragId);
      const targetIdx = prev.findIndex((i) => i.id === targetId);
      if (dragIdx < 0 || targetIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragId(null);
  }

  function indent(id: number) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx <= 0) return prev;
      const item = prev[idx];
      // Parent becomes the previous item at depth 0 (the one above this item).
      const prevItem = prev[idx - 1];
      // Don't indent under self or under a child (avoid cycles). Only allow
      // one level deep for simplicity.
      if (item.parentId !== null) return prev;
      const newParent = prevItem.parentId ?? prevItem.id;
      return prev.map((it) => (it.id === id ? { ...it, parentId: newParent } : it));
    });
  }

  function outdent(id: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, parentId: null } : it)));
  }

  function persist() {
    setSavedMsg(null);
    const order = items.map((it, idx) => ({
      id: it.id,
      parentId: it.parentId,
      sortOrder: idx,
    }));
    startTransition(async () => {
      try {
        await saveOrder(menuId, order);
        setSavedMsg("Saved.");
      } catch (err) {
        setSavedMsg(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {items.map((it) => {
          const indented = it.parentId !== null;
          return (
            <li
              key={it.id}
              draggable
              onDragStart={(e) => onDragStart(it.id, e)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(it.id)}
              onDragEnd={() => setDragId(null)}
              className={`flex items-center gap-3 px-3 py-2 bg-white/5 rounded cursor-move select-none ${
                dragId === it.id ? "opacity-40" : ""
              }`}
              style={{ marginLeft: indented ? 24 : 0 }}
            >
              <span aria-hidden className="text-white/30 font-mono text-xs">
                ⠿
              </span>
              <span className="flex-1 truncate">
                {indented && <span className="text-white/30 mr-1">↳</span>}
                <strong>{it.label}</strong>{" "}
                <span className="text-white/50 text-sm font-mono">→ {it.href}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => outdent(it.id)}
                  disabled={!indented}
                  title="Outdent (top-level)"
                  className="px-2 py-1 text-xs border border-white/10 rounded hover:bg-white/5 disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => indent(it.id)}
                  disabled={indented}
                  title="Indent (nest under previous item)"
                  className="px-2 py-1 text-xs border border-white/10 rounded hover:bg-white/5 disabled:opacity-30"
                >
                  →
                </button>
                <form action={deleteItem}>
                  <input type="hidden" name="id" value={it.id} />
                  <button className="px-2 py-1 text-xs border border-red-500/40 text-red-400 rounded hover:bg-red-500/10">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="px-3 py-2 text-white/50 text-sm">No items yet — add one below.</li>
        )}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={persist}
          disabled={pending}
          className="px-3 py-1.5 text-sm rounded bg-(--color-cyan)/20 border border-(--color-cyan)/40 hover:bg-(--color-cyan)/30 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save order"}
        </button>
        {savedMsg && (
          <span
            className={`text-xs font-mono ${
              savedMsg === "Saved." ? "text-(--color-green)" : "text-red-400"
            }`}
          >
            {savedMsg}
          </span>
        )}
      </div>

      <form action={addItem} className="flex gap-2">
        <input type="hidden" name="menuId" value={menuId} />
        <input
          name="label"
          placeholder="Label"
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded"
        />
        <input
          name="href"
          placeholder="/path or https://…"
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded"
        />
        <button className="px-4 py-2 rounded bg-neon-blue/30 border border-neon-blue/50 hover:bg-neon-blue/40 text-sm">
          Add
        </button>
      </form>
    </div>
  );
}

/**
 * Sort items so children appear directly under their parent in display order.
 * Hierarchy is limited to one level deep — children with their own children
 * are not supported by the current menu schema/UI.
 */
function sortItems(items: MenuItem[]): MenuItem[] {
  const byParent = new Map<number | null, MenuItem[]>();
  for (const it of items) {
    const arr = byParent.get(it.parentId) ?? [];
    arr.push(it);
    byParent.set(it.parentId, arr);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder);
  const roots = byParent.get(null) ?? [];
  const out: MenuItem[] = [];
  for (const r of roots) {
    out.push(r);
    for (const c of byParent.get(r.id) ?? []) out.push(c);
  }
  return out;
}
