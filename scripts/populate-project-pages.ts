/**
 * Populate empty CMS pages with project showcase content drawn from
 * the corresponding alfredang/<repo> on GitHub. Matches page slugs to
 * repo names with fuzzy fallback (handles -singapore → -sg, -game,
 * -demo suffixes, etc.). Skips pages that already have substantive
 * content.
 *
 * Each matched page is rewritten with:
 *  - H1 title (from repo name or page title)
 *  - Repo description as the lede
 *  - Live demo + GitHub buttons
 *  - GitHub OG image as screenshot
 *  - Topics + last-updated metadata
 *
 * Run: npx tsx --env-file=.env scripts/populate-project-pages.ts
 */
import { db } from "../src/db";
import { pages } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { writeFileSync, existsSync, readFileSync } from "fs";

type Repo = {
  name: string;
  description: string | null;
  homepage: string | null;
  html_url: string;
  topics?: string[];
  updated_at: string;
  pushed_at: string;
  archived: boolean;
  fork: boolean;
};

const REPO_CACHE = "/tmp/alfredang-repos.json";

async function loadRepos(): Promise<Repo[]> {
  if (existsSync(REPO_CACHE)) {
    const cached: Repo[] = JSON.parse(readFileSync(REPO_CACHE, "utf-8"));
    if (Array.isArray(cached) && cached.length > 0) return cached;
  }
  const all: Repo[] = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(
      `https://api.github.com/users/alfredang/repos?per_page=100&page=${page}&type=public`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!r.ok) throw new Error(`GitHub API ${r.status}`);
    const data = (await r.json()) as Repo[];
    if (data.length === 0) break;
    all.push(...data);
  }
  writeFileSync(REPO_CACHE, JSON.stringify(all));
  return all;
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^e281a0/, "") // strip the WP UTF-8 encoding artefact
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Manual slug → repo overrides for the cases the fuzzy matcher won't catch.
const MANUAL: Record<string, string> = {
  "ai-voice-agent": "voiceagent",
  "ai-hr-management-system": "tertiary-hrms",
  "tertiary-training-management-system": "tertiary-tms",
  "ssg-training-management-system": "ssg-tms-react-excel",
  "gamified-ai-learning-management-system": "AI-LMS-TMS",
  "openattestation-certificate-issuer": "oa-certificate-issuer-app",
  "openattestation-certificate-backend": "oa-certificate-issuer-backend",
  "opencert-blockchain-verifier": "opencert-verifier",
  "word-ppt-to-pdf-converter": "ppt-pdf-conversion",
  "markdown-to-pdf-converter": "pdf-converter-chrome-extension",
  "rich-text-to-markdown-converter": "md2pdf-chrome-extension",
  "course-certificate-generator": "singapore-cert-generator",
  "wsq-courseware-generator-claude-agents": "wsq-courseware-generator-claude-streamlit",
  "wsq-casl-course-proposal-generator": "wsq-casl-cp-generator",
  "modern-snake": "snake-game",
  "neon-tetris": "tetris-game",
  "futuristic-pong": "pong-game",
  "neon-pac-man": "pacman-game",
  "pastel-space-invaders": "space-invader-game",
  "retro-street-fighter": "street-fighter-game",
  "tic-tac-toe-ai": "tic-tac-toe-game",
  "kid-friendly-sudoku": "sudoku",
  "e281a0links-to-skills-framework-skills-report-skills-dashboard": "skills",
  "e281a0curriculum-development": "skills",
  "e281a0tpqa": "skills",
  "claude-code-skills-package": "skills",
  // Don't match: pure CMS leftovers / not-a-project
  // webteck-*, wishlist, blog, careers, training, services-*, gallery, etc.
};

const STRIP_PREFIXES = [
  "ai-",
  "neon-",
  "modern-",
  "pastel-",
  "retro-",
  "pixel-",
  "futuristic-",
  "groovy-",
  "educational-",
  "kid-friendly-",
  "gamified-",
  "interactive-",
];

function buildMatchCandidates(slug: string): string[] {
  const n = normalizeForMatch(slug);
  const variants = new Set<string>([n]);
  // strip -singapore / -sg
  variants.add(n.replace(/-singapore$/, ""));
  variants.add(n.replace(/-sg$/, ""));
  // -singapore <-> -sg
  variants.add(n.replace(/-singapore$/, "-sg"));
  variants.add(n.replace(/-sg$/, "-singapore"));
  // common suffixes
  for (const suf of ["-game", "-demo", "-app", "-tool", "-ai", "-2", "-3"]) {
    variants.add(n.replace(new RegExp(`${suf}$`), ""));
  }
  // strip prefixes, then re-add common suffixes
  for (const pre of STRIP_PREFIXES) {
    if (n.startsWith(pre)) {
      const stripped = n.slice(pre.length);
      variants.add(stripped);
      variants.add(stripped + "-game");
      variants.add(stripped + "-app");
      variants.add(stripped + "-demo");
    }
  }
  // collapse-dashes
  variants.add(n.replace(/-/g, ""));
  return [...variants].filter((v) => v.length >= 3);
}

function findRepo(slug: string, repos: Repo[]): Repo | null {
  const repoByNorm = new Map<string, Repo>();
  for (const r of repos) repoByNorm.set(normalizeForMatch(r.name), r);
  // Manual override has highest priority.
  const manual = MANUAL[normalizeForMatch(slug)];
  if (manual) {
    const r = repoByNorm.get(normalizeForMatch(manual));
    if (r) return r;
  }
  for (const cand of buildMatchCandidates(slug)) {
    const r = repoByNorm.get(cand);
    if (r) return r;
  }
  // contains-match as last resort
  const n = normalizeForMatch(slug);
  for (const r of repos) {
    const rn = normalizeForMatch(r.name);
    if (rn === n) return r;
    if (rn.length >= 6 && (rn.includes(n) || n.includes(rn))) return r;
  }
  return null;
}

function buildProjectHtml(repo: Repo, pageTitle: string): string {
  const title = pageTitle || repo.name;
  const desc = (repo.description ?? "").trim();
  const demo = (repo.homepage ?? "").trim();
  const ghUrl = repo.html_url;
  const og = `https://opengraph.githubassets.com/1/alfredang/${repo.name}`;
  const topics = (repo.topics ?? []).slice(0, 10);
  const updated = new Date(repo.pushed_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `
<p><strong>${escapeHtml(title)}</strong>${desc ? ` — ${escapeHtml(desc)}` : ""}</p>

<p>
  ${demo ? `<a href="${escapeAttr(demo)}" target="_blank" rel="noopener noreferrer"><strong>Live demo →</strong></a>` : ""}
  ${demo ? " &nbsp;·&nbsp; " : ""}
  <a href="${escapeAttr(ghUrl)}" target="_blank" rel="noopener noreferrer"><strong>View on GitHub →</strong></a>
</p>

<p><img src="${og}" alt="${escapeAttr(title)} — preview" /></p>

${desc ? `<h2>About the project</h2><p>${escapeHtml(desc)}</p>` : ""}

<h2>Project details</h2>
<table>
  <tbody>
    <tr><td><strong>Repository</strong></td><td><a href="${escapeAttr(ghUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.name)}</a></td></tr>
    ${demo ? `<tr><td><strong>Live demo</strong></td><td><a href="${escapeAttr(demo)}" target="_blank" rel="noopener noreferrer">${escapeHtml(demo)}</a></td></tr>` : ""}
    <tr><td><strong>Last update</strong></td><td>${updated}</td></tr>
    ${topics.length ? `<tr><td><strong>Topics</strong></td><td>${topics.map((t) => `<code>${escapeHtml(t)}</code>`).join(" · ")}</td></tr>` : ""}
  </tbody>
</table>

<h2>Want something like this?</h2>
<p>This project is part of our portfolio. We build bespoke web tools, AI applications, and educational experiences for Singapore organisations. <a href="/contact?source=project-${repo.name}">Get a free scoping call →</a></p>
`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function isEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  return html.replace(/<[^>]+>/g, "").trim().length < 50;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const repos = await loadRepos();
  console.log(`Loaded ${repos.length} repos`);

  const allPages = await db.select().from(pages);
  const emptyPages = allPages.filter((p) => isEmpty(p.contentHtml));
  console.log(`Empty pages: ${emptyPages.length}/${allPages.length}`);

  let matched = 0;
  let updated = 0;
  const unmatched: string[] = [];

  for (const p of emptyPages) {
    const repo = findRepo(p.slug, repos);
    if (!repo) {
      unmatched.push(p.slug);
      continue;
    }
    matched++;
    const html = buildProjectHtml(repo, p.title);
    const niceTitle =
      p.title === "Untitled page" || !p.title.trim() || p.title.toLowerCase() === p.slug
        ? repo.name
            .split(/[-_]/)
            .map((w) => w[0]?.toUpperCase() + w.slice(1))
            .join(" ")
        : p.title;
    if (!dryRun) {
      await db
        .update(pages)
        .set({
          title: niceTitle,
          excerpt: repo.description ?? null,
          contentHtml: html,
          // Minimal TipTap doc; admin can re-edit if needed
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: repo.description ?? niceTitle }],
              },
            ],
          },
          seoTitle: niceTitle.length > 60 ? niceTitle : `${niceTitle} | Tertiary Infotech Academy`,
          seoDescription: (repo.description ?? niceTitle).slice(0, 160),
          ogImage: `https://opengraph.githubassets.com/1/alfredang/${repo.name}`,
          updatedAt: new Date(),
        })
        .where(eq(pages.id, p.id));
      updated++;
    }
    console.log(`✓ ${p.slug.padEnd(48)} → ${repo.name}`);
  }

  console.log();
  console.log(`Matched: ${matched}  Updated: ${updated}  Unmatched: ${unmatched.length}`);
  if (unmatched.length > 0 && unmatched.length <= 60) {
    console.log("Unmatched slugs:");
    for (const s of unmatched) console.log("  -", s);
  } else if (unmatched.length > 60) {
    console.log(`(${unmatched.length} unmatched — first 30 shown)`);
    for (const s of unmatched.slice(0, 30)) console.log("  -", s);
  }
}
main().then(() => process.exit(0));
