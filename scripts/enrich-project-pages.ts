/**
 * Lead-gen project pages from alfredang/<repo>.
 * - Hero: title + tagline
 * - Big Live Demo button (when homepage is set) + GitHub link + Get-a-Quote
 * - Real screenshot only when README has one; otherwise no image
 * - About, Tech stack chips, Key features (from README), Project details
 * - "Want something like this?" CTA block
 * - All pages categorised under the "Portfolio" category
 *
 * Run: `npx tsx --env-file=.env scripts/enrich-project-pages.ts`
 */
import { db } from "../src/db";
import { pages, categories } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { existsSync, readFileSync, writeFileSync } from "fs";

type Repo = {
  name: string;
  description: string | null;
  homepage: string | null;
  html_url: string;
  language: string | null;
  topics?: string[];
  default_branch?: string;
  updated_at: string;
  pushed_at: string;
  archived: boolean;
  fork: boolean;
};

const REPO_CACHE = "/tmp/alfredang-repos.json";
const README_CACHE = "/tmp/alfredang-readmes.json";

async function loadRepos(): Promise<Repo[]> {
  if (existsSync(REPO_CACHE)) {
    const c = JSON.parse(readFileSync(REPO_CACHE, "utf-8"));
    if (Array.isArray(c) && c.length > 0) return c;
  }
  const all: Repo[] = [];
  for (let p = 1; p <= 5; p++) {
    const r = await fetch(
      `https://api.github.com/users/alfredang/repos?per_page=100&page=${p}&type=public`,
    );
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const data = (await r.json()) as Repo[];
    if (data.length === 0) break;
    all.push(...data);
  }
  writeFileSync(REPO_CACHE, JSON.stringify(all));
  return all;
}

async function loadReadme(repo: Repo): Promise<string | null> {
  const cache: Record<string, string | null> = existsSync(README_CACHE)
    ? JSON.parse(readFileSync(README_CACHE, "utf-8"))
    : {};
  if (Object.prototype.hasOwnProperty.call(cache, repo.name)) return cache[repo.name];
  const branches = [repo.default_branch || "main", "main", "master"];
  for (const b of [...new Set(branches)]) {
    const url = `https://raw.githubusercontent.com/alfredang/${repo.name}/${b}/README.md`;
    const r = await fetch(url);
    if (r.ok) {
      const md = await r.text();
      cache[repo.name] = md;
      writeFileSync(README_CACHE, JSON.stringify(cache));
      return md;
    }
  }
  cache[repo.name] = null;
  writeFileSync(README_CACHE, JSON.stringify(cache));
  return null;
}

function stripMd(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractFeatures(md: string | null): string[] {
  if (!md) return [];
  const sections = md.split(/\n##+\s+/g);
  for (const s of sections.slice(1)) {
    const headLine = s.split("\n", 1)[0];
    if (!/feature|highlight|capabilities|what\s+you|why/i.test(headLine)) continue;
    const body = s.slice(headLine.length);
    const bullets: string[] = [];
    for (const ln of body.split("\n")) {
      const m = /^\s*[-*+]\s+(.+?)\s*$/.exec(ln);
      if (m) bullets.push(stripMd(m[1]));
      else if (bullets.length > 0 && /^##+\s+/.test(ln.trim())) break;
    }
    if (bullets.length >= 3) return bullets.slice(0, 8);
  }
  return [];
}

function extractAbout(md: string | null, fallback: string | null): string {
  if (md) {
    const lines = md.split("\n");
    let i = 0;
    while (i < lines.length && /^(\s*)?(<.*>|!\[|\[!\[|#\s)/.test(lines[i])) i++;
    while (i < lines.length && lines[i].trim() === "") i++;
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      if (/^#/.test(lines[i])) break;
      para.push(lines[i]);
      i++;
    }
    const c = stripMd(para.join(" ")).replace(/\s+/g, " ").trim();
    if (c.length >= 60) return c;
  }
  return (fallback ?? "").trim();
}

/** Find a real screenshot image in the README, ignoring shields/badges. */
function extractScreenshot(md: string | null, repo: Repo): string | null {
  if (!md) return null;
  const branch = repo.default_branch || "main";
  // ![alt](url) or <img src="url">
  const matches: { alt: string; url: string }[] = [];
  for (const m of md.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    matches.push({ alt: m[1], url: m[2].split(/\s+/)[0] });
  }
  for (const m of md.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi)) {
    matches.push({ alt: m[2] || "", url: m[1] });
  }
  const looksLikeBadge = (u: string) =>
    /shields\.io|badge\.fury|img\.shields|api\.netlify|github\.com\/[^/]+\/[^/]+\/(?:actions|workflows)|circleci\.com|travis-ci|codecov|coveralls/i.test(
      u,
    );
  const looksLikeScreenshot = (alt: string, u: string) =>
    /(screenshot|preview|demo|hero|og[- ]?image|banner|app[-_ ]preview|cover)/i.test(`${alt} ${u}`);
  // Prefer images that look like screenshots
  const ranked = [...matches]
    .filter((m) => !looksLikeBadge(m.url))
    .sort((a, b) => {
      const sa = looksLikeScreenshot(a.alt, a.url) ? 0 : 1;
      const sb = looksLikeScreenshot(b.alt, b.url) ? 0 : 1;
      return sa - sb;
    });
  const pick = ranked[0];
  if (!pick) return null;
  let url = pick.url.trim();
  if (url.startsWith("//")) url = "https:" + url;
  if (!/^https?:/i.test(url)) {
    // relative path → raw.githubusercontent.com
    const cleaned = url.replace(/^\.?\/?/, "");
    url = `https://raw.githubusercontent.com/alfredang/${repo.name}/${branch}/${cleaned}`;
  }
  return url;
}

function detectStack(repo: Repo, md: string | null): string[] {
  const chips = new Set<string>();
  if (repo.language) chips.add(repo.language);
  for (const t of repo.topics ?? []) chips.add(t);
  const text = (md ?? "").toLowerCase();
  const f: { k: string | RegExp; c: string }[] = [
    { k: "next.js", c: "Next.js" },
    { k: "react", c: "React" },
    { k: "vite", c: "Vite" },
    { k: "streamlit", c: "Streamlit" },
    { k: "tailwind", c: "Tailwind CSS" },
    { k: "vercel", c: "Vercel" },
    { k: "supabase", c: "Supabase" },
    { k: "postgres", c: "Postgres" },
    { k: "drizzle", c: "Drizzle ORM" },
    { k: "prisma", c: "Prisma" },
    { k: "n8n", c: "n8n" },
    { k: "langchain", c: "LangChain" },
    { k: "langflow", c: "Langflow" },
    { k: "claude code", c: "Claude Code" },
    { k: "anthropic", c: "Claude / Anthropic" },
    { k: "openai", c: "OpenAI" },
    { k: "gradio", c: "Gradio" },
    { k: "huggingface", c: "HuggingFace" },
    { k: "fastapi", c: "FastAPI" },
    { k: "flask", c: "Flask" },
    { k: "django", c: "Django" },
    { k: "express", c: "Express" },
    { k: "solidity", c: "Solidity" },
    { k: "ethereum", c: "Ethereum" },
    { k: "blockchain", c: "Blockchain" },
    { k: "opencerts", c: "OpenCerts" },
    { k: "ssg api", c: "SSG TPGateway API" },
    { k: "wsq", c: "WSQ" },
    { k: "tpqa", c: "TPQA" },
    { k: "telegram", c: "Telegram" },
    { k: "playwright", c: "Playwright" },
    { k: /\btypescript\b/, c: "TypeScript" },
    { k: /\bjavascript\b/, c: "JavaScript" },
    { k: /\bpython\b/, c: "Python" },
  ];
  for (const { k, c } of f) {
    if (typeof k === "string" ? text.includes(k) : k.test(text)) chips.add(c);
  }
  return [...chips].filter((c) => c.length <= 40).slice(0, 12);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(repo: Repo, pageTitle: string, md: string | null): string {
  const title = pageTitle || repo.name;
  const desc = (repo.description ?? "").trim();
  const demo = (repo.homepage ?? "").trim();
  const ghUrl = repo.html_url;
  const features = extractFeatures(md);
  const stack = detectStack(repo, md);
  const about = extractAbout(md, desc) || desc || `${title} — a project by Tertiary Infotech Academy.`;
  const screenshot = extractScreenshot(md, repo);
  const updated = new Date(repo.pushed_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const ctaSource = `project-${repo.name.toLowerCase()}`;

  const liveDemoBlock = demo
    ? `<p><a href="${escapeHtml(demo)}" target="_blank" rel="noopener noreferrer"><strong>▶ Open live demo — ${escapeHtml(demo)}</strong></a></p>`
    : "";

  return `
<p><strong>${escapeHtml(desc || title)}</strong></p>

<p>
  ${demo ? `<a href="${escapeHtml(demo)}" target="_blank" rel="noopener noreferrer"><strong>Live demo →</strong></a> &nbsp;·&nbsp; ` : ""}
  <a href="${escapeHtml(ghUrl)}" target="_blank" rel="noopener noreferrer"><strong>View on GitHub →</strong></a> &nbsp;·&nbsp;
  <a href="/contact?source=${escapeHtml(ctaSource)}"><strong>Get a quote →</strong></a>
</p>

${liveDemoBlock}

${screenshot ? `<p><img src="${escapeHtml(screenshot)}" alt="${escapeHtml(title)} screenshot" /></p>` : ""}

<h2>About the project</h2>
<p>${escapeHtml(about)}</p>

${stack.length > 0 ? `<h2>Tech stack</h2><p>${stack.map((s) => `<code>${escapeHtml(s)}</code>`).join(" &nbsp; ")}</p>` : ""}

${features.length > 0 ? `<h2>Key features</h2><ul>${features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>` : ""}

<h2>Project details</h2>
<table>
  <tbody>
    <tr><td><strong>Repository</strong></td><td><a href="${escapeHtml(ghUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.name)}</a></td></tr>
    ${demo ? `<tr><td><strong>Live demo</strong></td><td><a href="${escapeHtml(demo)}" target="_blank" rel="noopener noreferrer">${escapeHtml(demo)}</a></td></tr>` : ""}
    <tr><td><strong>Primary language</strong></td><td>${escapeHtml(repo.language ?? "—")}</td></tr>
    <tr><td><strong>Last update</strong></td><td>${updated}</td></tr>
  </tbody>
</table>

<h2>Want something like this for your team?</h2>
<p>We build bespoke web tools, AI applications, dashboards, training simulators, and integrations for Singapore organisations — from a single-file browser tool to a full Next.js + Postgres + AI stack. Fixed-fee scoping, weekly demos, no vendor lock-in.</p>
<p><strong>Three ways to start:</strong></p>
<ul>
  <li><a href="/contact?source=${escapeHtml(ctaSource)}-call">Book a 30-minute scoping call →</a></li>
  <li><a href="/contact?source=${escapeHtml(ctaSource)}-quote">Request a custom-build quote →</a></li>
  <li><a href="/ai-solutions?source=${escapeHtml(ctaSource)}-aisol">Browse our AI Solutions service →</a></li>
</ul>

<p><em>Built and maintained by <a href="https://www.tertiaryinfotech.com">Tertiary Infotech Academy</a> — see our <a href="/ai-solutions?source=${escapeHtml(ctaSource)}-foot">AI Solutions</a>, <a href="/ai-agent-deployment?source=${escapeHtml(ctaSource)}-foot">AI Agent Deployment</a>, and <a href="/training-management-system?source=${escapeHtml(ctaSource)}-foot">Training Management System</a> services.</em></p>
`.trim();
}

async function ensurePortfolioCategory(): Promise<number> {
  const ex = await db.select().from(categories).where(eq(categories.slug, "portfolio"));
  if (ex[0]) return ex[0].id;
  const [ins] = await db
    .insert(categories)
    .values({
      slug: "portfolio",
      name: "Portfolio",
      description: "Project showcases — bespoke web tools, AI apps, and training systems built by Tertiary Infotech Academy.",
    })
    .returning();
  return ins.id;
}

async function main() {
  const repos = await loadRepos();
  const repoByName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
  const portfolioCatId = await ensurePortfolioCategory();
  const all = await db.select().from(pages);

  // Target: every page whose body references a github.com/alfredang/<repo> URL.
  const targets = all.filter((p) => /github\.com\/alfredang\/([\w.-]+)/i.test(p.contentHtml ?? ""));

  console.log(`Pages to enrich: ${targets.length}  (Portfolio category id: ${portfolioCatId})`);
  let updated = 0;
  for (const p of targets) {
    const m = /github\.com\/alfredang\/([\w.-]+)/i.exec(p.contentHtml ?? "");
    const name = m?.[1] ?? "";
    const repo = repoByName.get(name.toLowerCase());
    if (!repo) {
      console.log(`  ! ${p.slug} → no repo match for "${name}"`);
      continue;
    }
    const md = await loadReadme(repo);
    const html = buildHtml(repo, p.title || repo.name, md);
    await db
      .update(pages)
      .set({
        contentHtml: html,
        excerpt: (repo.description ?? p.excerpt ?? "").slice(0, 300),
        seoDescription: (repo.description ?? p.seoDescription ?? "").slice(0, 160),
        ogImage: null, // no auto-OG; let metadata fall back to site default unless real screenshot exists
        categoryId: portfolioCatId,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, p.id));
    updated++;
    console.log(`✓ ${p.slug.padEnd(48)} ← ${repo.name}`);
  }
  console.log(`Enriched ${updated}/${targets.length} pages, all categorised as Portfolio.`);
}
main().then(() => process.exit(0));
