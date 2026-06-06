import Link from "next/link";
import { db } from "@/db";
import { tags, postTags } from "@/db/schema";
import { asc, sql } from "drizzle-orm";
import { Container } from "@/components/layout/Container";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All Tags — Journal",
  description:
    "Browse every tag across the Tertiary Infotech Academy journal — AI, agentic AI, SSG funding, WSQ, TPQA, training management, and more.",
  alternates: { canonical: "/blog/tags" },
  openGraph: {
    type: "website",
    url: "https://www.tertiaryinfotech.com/blog/tags",
    title: "All Tags — Tertiary Infotech Academy Journal",
    description:
      "Every tag in our journal — AI, SSG, WSQ, TPQA, TMS, agentic AI and more.",
    locale: "en_SG",
    siteName: "Tertiary Infotech Academy",
    images: [{ url: "/icon-192.png", width: 192, height: 192, alt: "Tertiary Infotech Academy" }],
  },
};

export default async function AllTagsPage() {
  const [allTags, tagCounts] = await Promise.all([
    db.select().from(tags).orderBy(asc(tags.name)),
    db
      .select({ tagId: postTags.tagId, count: sql<number>`count(*)::int` })
      .from(postTags)
      .groupBy(postTags.tagId),
  ]);
  const countByTagId = new Map<number, number>(tagCounts.map((r) => [r.tagId, r.count]));
  const sorted = [...allTags].sort(
    (a, b) => (countByTagId.get(b.id) ?? 0) - (countByTagId.get(a.id) ?? 0) || a.name.localeCompare(b.name),
  );

  return (
    <>
      <Navbar />
      <main>
        <section className="relative pt-24 pb-10 overflow-hidden">
          <div className="grid-bg opacity-60" />
          <div
            className="glow-blob"
            style={{
              top: "-30%",
              left: "20%",
              width: 500,
              height: 500,
              background: "radial-gradient(circle, #5C00E5 0%, transparent 70%)",
            }}
          />
          <Container className="relative">
            <div className="kicker mb-4">[ JOURNAL · TAGS ]</div>
            <h1 className="font-display text-[clamp(1.75rem,4vw,3rem)] font-extrabold leading-[1.15]">
              All <span className="gradient-text">Tags</span>
            </h1>
            <p className="mt-4 text-(--color-muted) text-lg max-w-2xl">
              {sorted.length} tags across the journal. Click any tag to filter posts.
            </p>
            <div className="mt-6">
              <Link
                href="/blog"
                className="text-sm text-(--color-cyan) hover:underline"
              >
                ← Back to all posts
              </Link>
            </div>
          </Container>
        </section>

        <section className="pb-24">
          <Container>
            <div className="flex flex-wrap gap-2">
              {sorted.map((t) => {
                const count = countByTagId.get(t.id) ?? 0;
                return (
                  <Link
                    key={t.id}
                    href={`/blog?tag=${encodeURIComponent(t.slug)}`}
                    className="px-3 py-1.5 rounded-full border text-sm transition bg-white/3 border-white/10 text-white/70 hover:text-white hover:border-(--color-cyan)/40 hover:bg-(--color-cyan)/5"
                  >
                    #{t.name}
                    <span className="ml-2 text-xs text-white/40">{count}</span>
                  </Link>
                );
              })}
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
