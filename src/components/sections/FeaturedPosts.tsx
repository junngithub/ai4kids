import Link from "next/link";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { Container } from "@/components/layout/Container";
import { HiArrowUpRight, HiStar } from "react-icons/hi2";
import { HiThumbUp } from "react-icons/hi";

function snippetFromHtml(html: string | null | undefined, max = 200): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

async function loadFeatured(limit: number) {
  try {
    const all = await db
      .select()
      .from(posts)
      .where(and(eq(posts.status, "published"), eq(posts.featured, true)));
    // Random pick `limit` from the featured set on every request.
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, limit);
  } catch {
    return [];
  }
}

async function loadLatest(limit: number, excludeIds: number[]) {
  try {
    const rows = await db
      .select()
      .from(posts)
      .where(eq(posts.status, "published"))
      .orderBy(desc(posts.publishedAt))
      .limit(limit + excludeIds.length);
    return rows.filter((r) => !excludeIds.includes(r.id)).slice(0, limit);
  } catch {
    return [];
  }
}

type PostLite = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml: string | null;
  featuredImage: string | null;
  publishedAt: Date | null;
  likeCount: number;
};

function PostCard({ p }: { p: PostLite }) {
  return (
    <Link
      href={`/blog/${p.slug}`}
      className="card-hover glass overflow-hidden flex flex-col group"
    >
      <div className="aspect-[16/10] overflow-hidden bg-(--color-bg-deeper) relative">
        {p.featuredImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.featuredImage}
            alt={p.title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-(--color-purple)/30 to-(--color-cyan)/20" />
        )}
      </div>
      <div className="p-6 flex-1 flex flex-col">
        {p.publishedAt && (
          <div className="kicker mb-3">
            {new Date(p.publishedAt).toLocaleDateString("en-SG", {
              year: "numeric",
              month: "short",
              day: "2-digit",
            })}
          </div>
        )}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-display font-bold text-xl text-white group-hover:text-(--color-cyan) transition flex-1 min-w-0">
            {p.title}
          </h3>
          <span
            className="shrink-0 inline-flex items-center gap-1 text-xs font-mono text-(--color-muted) mt-1"
            aria-label={`${p.likeCount} likes`}
            title={`${p.likeCount} likes`}
          >
            <HiThumbUp className="w-3.5 h-3.5 text-(--color-cyan)" />
            {p.likeCount}
          </span>
        </div>
        {(() => {
          const teaser = p.excerpt || snippetFromHtml(p.contentHtml);
          return teaser ? (
            <p className="text-sm text-(--color-muted) line-clamp-3 leading-relaxed">
              {teaser}
            </p>
          ) : null;
        })()}
      </div>
    </Link>
  );
}

export async function FeaturedPosts() {
  const featured = await loadFeatured(3);
  const latest = await loadLatest(3, featured.map((p) => p.id));
  if (featured.length === 0 && latest.length === 0) return null;

  return (
    <section className="relative py-4 space-y-16">
      {featured.length > 0 && (
        <Container>
          <div className="flex items-end justify-between mb-6 gap-6 flex-wrap">
            <div>
              <div className="kicker mb-4 flex items-center gap-2">
                <HiStar className="w-4 h-4 text-(--color-amber)" />
                [ FEATURED ]
              </div>
              <h2 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05]">
                Featured articles
              </h2>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-mono text-(--color-cyan) hover:gap-3 transition-all"
            >
              ALL ARTICLES <HiArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {featured.map((p) => (
              <PostCard key={p.id} p={p} />
            ))}
          </div>
        </Container>
      )}

      {latest.length > 0 && (
        <Container>
          <div className="flex items-end justify-between mb-6 gap-6 flex-wrap">
            <div>
              <div className="kicker mb-4">[ LATEST ]</div>
              <h2 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05]">
                From our blog
              </h2>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-mono text-(--color-cyan) hover:gap-3 transition-all"
            >
              ALL ARTICLES <HiArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {latest.map((p) => (
              <PostCard key={p.id} p={p} />
            ))}
          </div>
        </Container>
      )}
    </section>
  );
}
