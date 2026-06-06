import Link from "next/link";
import { db } from "@/db";
import { programs, classes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import {
  CATEGORIES,
  AGE_BANDS,
  CATEGORY_BY_SLUG,
  formatPrice,
} from "@/lib/portal-content";

export const dynamic = "force-dynamic";

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; age?: string }>;
}) {
  const { category, age } = await searchParams;
  const ageBand = AGE_BANDS.find((b) => b.slug === age);

  const all = await db
    .select()
    .from(programs)
    .where(eq(programs.published, true))
    .catch(() => []);

  const filtered = all.filter((p) => {
    if (category && p.category !== category) return false;
    if (ageBand && (p.ageMax < ageBand.min || p.ageMin > ageBand.max)) return false;
    return true;
  });

  // Count open classes per program for the badge.
  const openClasses = await db.select().from(classes).catch(() => []);
  const openByProgram = new Map<number, number>();
  for (const c of openClasses) {
    if (c.status === "open") openByProgram.set(c.programId, (openByProgram.get(c.programId) ?? 0) + 1);
  }

  return (
    <div className="bg-cream min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-fun text-4xl font-700 text-slate-900">Explore programs</h1>
        <p className="mt-1 font-round text-slate-500">
          Small live classes where kids build real things with AI.
        </p>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-2">
          <FilterChip href="/programs" active={!category && !age} label="All" />
          {CATEGORIES.map((c) => (
            <FilterChip
              key={c.slug}
              href={`/programs?category=${c.slug}`}
              active={category === c.slug}
              label={`${c.emoji} ${c.title}`}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {AGE_BANDS.map((b) => (
            <FilterChip
              key={b.slug}
              href={`/programs?age=${b.slug}`}
              active={age === b.slug}
              label={`${b.emoji} Ages ${b.slug}`}
              subtle
            />
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-12 rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">
            No programs match yet — check back soon! 🐣
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const cat = CATEGORY_BY_SLUG[p.category];
              const open = openByProgram.get(p.id) ?? 0;
              return (
                <Link
                  key={p.id}
                  href={`/programs/${p.slug}`}
                  className={`rounded-3xl bg-white p-6 shadow-sm ring-1 transition hover:-translate-y-1 hover:shadow-lg ${cat?.ring ?? "ring-amber-100"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${cat?.accent ?? ""}`}>
                      {p.emoji ?? cat?.emoji ?? "✨"}
                    </div>
                    {open > 0 && (
                      <span className="rounded-full bg-mint/20 px-2 py-1 text-xs font-600 text-emerald-600">
                        {open} class{open > 1 ? "es" : ""} open
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-fun text-lg font-700 text-slate-800">{p.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.summary}</p>
                  <div className="mt-3 flex items-center justify-between font-fun">
                    <span className="text-sm text-slate-400">Ages {p.ageMin}–{p.ageMax}</span>
                    <span className="font-700 text-coral">{formatPrice(p.priceCents)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
  subtle,
}: {
  href: string;
  active: boolean;
  label: string;
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 font-fun text-sm font-600 transition ${
        active
          ? "bg-slate-800 text-white"
          : subtle
            ? "bg-white text-slate-500 ring-1 ring-amber-100 hover:bg-amber-50"
            : "bg-white text-slate-600 ring-1 ring-amber-100 hover:bg-amber-50"
      }`}
    >
      {label}
    </Link>
  );
}
