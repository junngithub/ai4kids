"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

export type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  type: "page" | "post";
  pageCount: number;
  postCount: number;
};

type Props = {
  rows: CategoryRow[];
  activeTab: "page" | "post";
  add: (fd: FormData) => Promise<void>;
  update: (fd: FormData) => Promise<void>;
  remove: (fd: FormData) => Promise<void>;
};

export function CategoriesAdminTabs({ rows, activeTab, add, update, remove }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const filtered = rows.filter((r) => r.type === activeTab);
  const pageTotal = rows.filter((r) => r.type === "page").length;
  const postTotal = rows.filter((r) => r.type === "post").length;

  function onDelete(id: number, count: number) {
    if (
      count > 0 &&
      !confirm(`This category is used by ${count} item${count === 1 ? "" : "s"}. They will be set to Uncategorised. Continue?`)
    )
      return;
    const fd = new FormData();
    fd.set("id", String(id));
    startTransition(async () => {
      await remove(fd);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-white/10">
        <TabLink href="/admin/categories?tab=page" active={activeTab === "page"}>
          Page categories <span className="text-white/40 ml-1 font-mono">[{pageTotal}]</span>
        </TabLink>
        <TabLink href="/admin/categories?tab=post" active={activeTab === "post"}>
          Blog categories <span className="text-white/40 ml-1 font-mono">[{postTotal}]</span>
        </TabLink>
      </div>

      <form action={add} className="glass rounded-xl p-3 flex gap-2 items-center">
        <input type="hidden" name="type" value={activeTab} />
        <input
          name="name"
          placeholder={activeTab === "page" ? "New page category name…" : "New blog category name…"}
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:outline-none focus:border-(--color-cyan)/40"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded bg-(--color-cyan)/20 border border-(--color-cyan)/40 hover:bg-(--color-cyan)/30 text-(--color-cyan) text-sm font-medium"
        >
          + Add
        </button>
      </form>

      <div className="glass rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-[11px] uppercase text-white/60">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2 w-[90px] text-right whitespace-nowrap">
                {activeTab === "page" ? "Pages" : "Posts"}
              </th>
              <th className="px-3 py-2 w-[140px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-white/50 text-xs">
                  No {activeTab === "page" ? "page" : "blog"} categories yet.
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const used = activeTab === "page" ? c.pageCount : c.postCount;
              const isEditing = editingId === c.id;
              return (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                  {isEditing ? (
                    <td colSpan={4} className="px-3 py-2">
                      <form
                        action={update}
                        onSubmit={() => setEditingId(null)}
                        className="flex flex-wrap gap-2 items-center"
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <input
                          name="name"
                          defaultValue={c.name}
                          required
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-sm min-w-[180px]"
                        />
                        <input
                          name="slug"
                          defaultValue={c.slug}
                          required
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono min-w-[200px]"
                        />
                        <select
                          name="type"
                          defaultValue={c.type}
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
                        >
                          <option value="page">Page</option>
                          <option value="post">Blog</option>
                        </select>
                        <button
                          type="submit"
                          className="px-3 py-1 rounded bg-(--color-green)/20 border border-(--color-green)/40 text-(--color-green) text-xs"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 rounded border border-white/10 text-white/60 text-xs"
                        >
                          Cancel
                        </button>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-1.5 font-medium">{c.name}</td>
                      <td className="px-3 py-1.5 text-white/60 font-mono text-xs whitespace-nowrap">
                        /{c.slug}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                            used > 0
                              ? "bg-(--color-cyan)/10 text-(--color-cyan) border-(--color-cyan)/30"
                              : "bg-white/5 text-white/40 border-white/10"
                          }`}
                        >
                          {used}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          onClick={() => setEditingId(c.id)}
                          className="text-xs text-(--color-cyan) hover:underline mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(c.id, used)}
                          disabled={pending}
                          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
        active
          ? "border-(--color-cyan) text-(--color-cyan)"
          : "border-transparent text-white/60 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
