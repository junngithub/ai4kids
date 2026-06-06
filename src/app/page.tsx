import Link from "next/link";
import { db } from "@/db";
import { programs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { CATEGORIES, AGE_BANDS, formatPrice } from "@/lib/portal-content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const published = await db
    .select()
    .from(programs)
    .where(eq(programs.published, true))
    .catch(() => []);

  return (
    <div className="bg-cream">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-16 top-10 h-48 w-48 rounded-full bg-sunny/30 blur-2xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-56 w-56 rounded-full bg-sky/20 blur-2xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-fun font-600 text-sm text-coral shadow-sm">
              ✨ Ages 4–16 · Live classes + play-at-home
            </span>
            <h1 className="mt-4 font-fun text-4xl font-700 leading-tight text-slate-900 md:text-6xl">
              Kids don't just <span className="text-coral">use</span> AI here.
              <br />
              They <span className="text-sky-500">make</span> with it.
            </h1>
            <p className="mt-4 max-w-md font-round text-lg text-slate-600">
              Storytelling, coding, game design, phonics and escape rooms — a
              gamified playground where your child builds real things with AI.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/programs"
                className="rounded-full bg-coral px-6 py-3 font-fun text-lg font-700 text-white shadow-lg shadow-coral/30 transition hover:scale-105"
              >
                Book a free trial 🎉
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-white px-6 py-3 font-fun text-lg font-700 text-slate-700 shadow-md transition hover:scale-105"
              >
                Kid login 🚀
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {CATEGORIES.slice(0, 4).map((c, i) => (
              <div
                key={c.slug}
                className={`rounded-3xl bg-white p-5 shadow-md ring-1 ${c.ring} ${
                  i % 2 ? "translate-y-4" : ""
                }`}
              >
                <div className="text-4xl">{c.emoji}</div>
                <div className="mt-2 font-fun font-700 text-slate-800">{c.title}</div>
                <p className="mt-1 text-sm text-slate-500">{c.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-center font-fun text-3xl font-700 text-slate-900">
          Six ways to play & learn
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/programs?category=${c.slug}`}
              className={`group rounded-3xl bg-white p-6 shadow-sm ring-1 transition hover:-translate-y-1 hover:shadow-lg ${c.ring}`}
            >
              <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${c.accent}`}>
                {c.emoji}
              </div>
              <h3 className="mt-3 font-fun text-xl font-700 text-slate-800">{c.title}</h3>
              <p className="mt-1 text-slate-500">{c.blurb}</p>
              <span className="mt-3 inline-block font-fun font-600 text-coral group-hover:underline">
                Explore →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Age bands */}
      <section id="ages" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-center font-fun text-3xl font-700 text-slate-900">
          A path for every age
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AGE_BANDS.map((b) => (
            <Link
              href={`/programs?age=${b.slug}`}
              key={b.slug}
              className="rounded-3xl bg-gradient-to-b from-white to-amber-50 p-6 text-center shadow-sm ring-1 ring-amber-100 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="text-5xl">{b.emoji}</div>
              <div className="mt-2 font-fun text-2xl font-700 text-slate-800">{b.label}</div>
              <div className="font-round text-slate-500">Ages {b.slug}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-center font-fun text-3xl font-700 text-slate-900">How it works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            { n: "1", t: "Pick a program", d: "Browse by interest or age and book a class in seconds.", e: "🧭" },
            { n: "2", t: "Confirm & pay", d: "Once the class is confirmed we email you a PayNow QR to pay.", e: "💳" },
            { n: "3", t: "Learn & level up", d: "Kids play AI activities, earn scores and badges — you watch them grow.", e: "🌟" },
          ].map((s) => (
            <div key={s.n} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-amber-100">
              <div className="text-4xl">{s.e}</div>
              <div className="mt-2 font-fun text-xl font-700 text-slate-800">
                {s.n}. {s.t}
              </div>
              <p className="mt-1 text-slate-500">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured programs */}
      {published.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-end justify-between">
            <h2 className="font-fun text-3xl font-700 text-slate-900">Popular classes</h2>
            <Link href="/programs" className="font-fun font-600 text-coral hover:underline">
              See all →
            </Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {published.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                href={`/programs/${p.slug}`}
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-amber-100 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="text-3xl">{p.emoji ?? "✨"}</div>
                <h3 className="mt-2 font-fun text-lg font-700 text-slate-800">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.summary}</p>
                <div className="mt-3 flex items-center justify-between font-fun">
                  <span className="text-sm text-slate-400">Ages {p.ageMin}–{p.ageMax}</span>
                  <span className="font-700 text-coral">{formatPrice(p.priceCents)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-[2rem] bg-gradient-to-r from-coral to-bubble p-10 text-center text-white shadow-xl">
          <h2 className="font-fun text-3xl font-700 md:text-4xl">Ready to start building with AI?</h2>
          <p className="mx-auto mt-2 max-w-lg font-round text-white/90">
            Book a free trial class today. Spaces are small and fill up fast!
          </p>
          <Link
            href="/programs"
            className="mt-6 inline-block rounded-full bg-white px-8 py-3 font-fun text-lg font-700 text-coral shadow-lg transition hover:scale-105"
          >
            Book a free trial 🎉
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
