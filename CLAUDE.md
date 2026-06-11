# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Company

- **Legal name**: Tertiary Infotech Academy Pte Ltd
- **Short name / brand**: **Tertiary Infotech Academy** (not "Tertiary Infotech")
- Use the short name in UI copy, page titles, OG/Twitter metadata, footer, and lead-notification emails. The legal name is for schema.org `Organization`, T&Cs, and invoices only.

## Commands

```bash
npm run dev            # Next.js dev server (Turbopack) on http://localhost:3080
npm run build          # Production build
npm run start          # Run the production build locally on http://localhost:3080
npm run lint           # Next lint (note: ESLint isn't configured at the root; Next's wrapper is what's used)

npm run db:push        # Apply src/db/schema.ts to local Postgres (dev only)
npm run db:migrate     # Run generated migrations (prod-safe)
npm run db:generate    # Generate migrations from schema changes
npm run db:studio      # Drizzle Studio (DB browser)

npm run seed:admin     # Seed initial admin user + default menus + settings (one-time)
npm run migrate:wp     # Import a WordPress SQL dump (parses wp_*, downloads images, writes 301 redirects)
```

There is no test suite — verification is `npm run build` + browser smoke-testing the dev server. The Next build also runs the TS type-check, so it's the canonical "is this broken" gate.

**Port**: this project runs on **3080**, not Next's default 3000 — port 3000 is used by another local app, and 3070 is used by the main Tertiary Infotech Academy site. Both `dev` and `start` pass `-p 3080`; `.env` (`AUTH_URL`, `NEXT_PUBLIC_SITE_URL`) is pinned to `http://localhost:3080`. If you change the port, update all three in lockstep or Auth.js will silently issue cookies for the wrong host.

**ALWAYS** start the local dev server at `http://localhost:3080/` — never on 3000, 3070, or any other port. Use `npm run dev` (which already binds 3080); never `next dev` directly without `-p 3080`. When opening the app in a browser or sharing URLs, use `http://localhost:3080/` (not `localhost:3000` or `localhost:3070`). Before starting, check that 3080 is free with `lsof -ti:3080`; if a stale process is bound, kill it rather than falling back to another port.

**If the user reports `http://localhost:3080/` is down (or "the local site isn't working", "localhost not loading", etc.), bring it back up immediately — do NOT wait for the user to ask explicitly.** Procedure: (1) `lsof -ti:3080` to see if anything is bound; (2) if nothing is bound, run `npm run dev` in the background; (3) verify with `curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3080/` returning `HTTP 200` before reporting success. Treat dev-server restarts as part of the standard workflow, not a separate task.

### Ad-hoc TS scripts

`scripts/*.ts` are run via `tsx`. `tsx` does **not** auto-load `.env`. Either invoke them through the npm scripts (which pass `--env-file=.env`) or source the env first:

```bash
set -a; source .env; set +a; npx tsx scripts/<name>.ts
```

The `DATABASE_URL` in `.env` points at local Postgres. The production DB hostname is a Coolify-internal Docker service name and **is not routable from outside** — direct DB access from a developer machine is impossible. Use the sync API instead (see below).

## Architecture

Self-hosted CMS on Next.js 16 App Router + Drizzle (Postgres) + Auth.js v5. The README has the feature list and folder layout; the points below capture invariants that aren't obvious from one file.

### CMS content is DB-driven with hardcoded fallbacks

Several UI surfaces render from the DB **with a code-level fallback** that takes over on DB failure. When the user asks you to change one of these, you usually have to update the DB **AND** the fallback **AND** any seeder script that recreates it. Otherwise the change is invisible in some environments.

- **Header / footer nav** — [src/components/layout/Navbar.tsx](src/components/layout/Navbar.tsx) reads `menus` + `menu_items` from Postgres; on failure or empty result it falls back to the `FALLBACK` const in the same file. The canonical "rebuild the menu from code" script is [scripts/reset-header-menu.ts](scripts/reset-header-menu.ts) — when you rename a menu item you usually need to touch three places: DB row, `FALLBACK`, and the reset script.
- **Site brand (name, logo)** — [src/lib/site-settings.ts](src/lib/site-settings.ts) reads `settings` rows; defaults are inline.
- **Pages + Posts** — fully DB-only via `pages` / `posts` (no code fallback). Slug is the natural key; status is `draft|published|archived`.

### Credentials & secrets pipeline

`AUTH_SECRET` is load-bearing — it both signs Auth.js sessions **and** derives (via SHA-256) the AES-256-GCM key for the admin credentials vault. Rotating `AUTH_SECRET` makes every encrypted credential undecryptable; if you must rotate it, re-save every credential in `/admin/settings/credentials` afterwards.

Credential lookup pattern, used for Gmail OAuth, Anthropic OAuth, Firecrawl, Tavily — see [src/lib/secrets.ts](src/lib/secrets.ts):

1. `getCredential(key)` first reads `settings` where `key = 'cred:<name>'` and decrypts.
2. Falls back to the matching `process.env.<NAME>` if no DB row.
3. Returns null if neither.

When adding a new secret, **prefer DB-stored** (extend `CredentialKey`, add an `/admin/settings/credentials` field). Only fall back to env if the value is needed before the DB is reachable (e.g. `DATABASE_URL` itself, `AUTH_SECRET`, `SYNC_API_TOKEN`). The `.env` file should stay minimal — boot-time vars only. Operational config (Gmail, lead-notification email, AI tokens) lives in `/admin/settings`.

### Local → Remote DB sync

The production DB isn't directly reachable. To push local CMS data (menus, settings, pages, posts, taxonomy) to production, use the dedicated sync layer:

- **HTTPS API**: `POST /api/admin/sync/{menus,settings,taxonomy,pages,posts}` under [src/app/api/admin/sync/](src/app/api/admin/sync/).
- **Auth**: shared by [src/lib/sync-auth.ts](src/lib/sync-auth.ts) — accepts **either** `Authorization: Bearer <SYNC_API_TOKEN>` (matching env on both sides) or `Authorization: Basic <base64(email:password)>` (validated against the `users` table via bcrypt). Fails closed.
- **CLI**: [scripts/push-to-remote.ts](scripts/push-to-remote.ts) — reads local DB, resolves FKs by natural key (authors by email, categories/tags by slug), POSTs in dependency order (`taxonomy → settings → menus → pages → posts`). The CLI auto-picks bearer if `SYNC_API_TOKEN` is set locally, otherwise Basic with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- **Slash command**: `/push-to-remote [resource...|all]` — wraps the CLI with a preview + confirmation flow. See [.claude/commands/push-to-remote.md](.claude/commands/push-to-remote.md).

To extend the sync surface to a new table, follow the pattern in [.claude/skills/remote-db-sync/SKILL.md](.claude/skills/remote-db-sync/SKILL.md): natural-key upsert, Zod-bounded payload, register the resource in `scripts/push-to-remote.ts` in the correct FK-dependency order.

### Authoring blog posts — always load the `blog-post` skill first

Any request to write, publish, edit, or fix a blog post (`/blog/...`) — phrases like "create a blog on X", "write a post about Y", "add a journal entry", "draft a guide", or any change to body content for an existing post — **must** load [.claude/skills/blog-post/SKILL.md](.claude/skills/blog-post/SKILL.md) **before drafting a single line**. The skill covers the non-obvious must-dos that have bitten us repeatedly:

- The public `/blog/[slug]` page renders **`posts.contentHtml`** (not `content`). If you only set the TipTap JSON, the page looks empty. Always pre-render with [src/lib/tiptap-html.ts](src/lib/tiptap-html.ts) and populate both columns.
- Do NOT prefix the opening summary with the literal label "TL;DR —" — write the summary directly.
- Web-search 1–2 fresh sources before drafting topical posts (AI agents, framework launches, regulator news). Hyperlink the canonical product/project URL inline.
- Every external `<a>` needs `target="_blank" rel="noopener noreferrer"` and a descriptive `title`.
- At least 3 lead-gen CTAs to `/contact?source=blog-<token>` with distinct tokens per position.
- At least 2 deep links to specific tertiarycourses.com.sg course pages (never the homepage).
- Cover image must come from `renderAndUploadCover()` (R2) — never `public/` or local disk.

Also load `seo-audit`, `lead-magnets`, and `blog-cover-image` skills alongside it — the blog-post skill explicitly coordinates with them. After publishing locally, run `npx tsx --env-file=.env scripts/push-to-remote.ts posts` to sync the row to production.

### AI features run through the Claude Agent SDK with OAuth subscription auth

Both the public AI chatbot ([src/app/api/chat](src/app/api/chat)) and the admin AI Assist buttons ([src/app/api/ai/assist](src/app/api/ai/assist)) use `@anthropic-ai/claude-agent-sdk` rather than the metered Anthropic API. The `anthropic_auth_token` (an `sk-ant-oat-...` OAuth subscription token from `claude setup-token`) is read via `getCredential()` and injected into the SDK subprocess env by [src/lib/anthropic-auth.ts](src/lib/anthropic-auth.ts) — it's never exposed to the browser. No per-call API billing.

**HARD POLICY — DO NOT VIOLATE:**
- **Never** call the Anthropic Messages API (`https://api.anthropic.com/v1/messages`) directly from this codebase.
- **Never** add an Anthropic API key (`sk-ant-api*`) anywhere — not in env, not in DB credentials, not in code.
- The **only** LLM path in this app is the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) authenticated with the OAuth **subscription** token (`sk-ant-oat*`) stored under `anthropic_auth_token` in the encrypted credentials store.
- If the chatbot needs to be faster, add deterministic FAQ / pattern matching in [src/lib/chatbot-harness.ts](src/lib/chatbot-harness.ts) — never an HTTP API call.

### Public route layout & SEO

- Single landing page composes section components from [src/components/sections/](src/components/sections/) — `SERVICES` in [src/lib/site-content.ts](src/lib/site-content.ts) is the source of truth for the services grid; items can carry an optional `href` to make the card route to a dedicated page (see the SSG ATO example).
- `[slug]` (dynamic CMS page) and `blog/[slug]` consult `redirects` first before 404'ing — preserves WordPress URLs after migration.
- Each public route exports `metadata` (or `generateMetadata`) plus inline JSON-LD via `dangerouslySetInnerHTML`. `sitemap.ts` enumerates hardcoded routes + DB-published pages and posts.
- The SEO conventions for this codebase (canonical URL, OG, money keywords, schema choices per page type, British/Singapore spelling) are in [.claude/skills/seo-audit/SKILL.md](.claude/skills/seo-audit/SKILL.md) — load that skill whenever creating or auditing a public route.

### Lead capture

Every public form (contact form, SSG ATO consultation form, etc.) POSTs to `/api/contact` with `{ name, email, phone?, company?, message, source }`. The `source` field identifies which page/magnet produced the lead — set it per form (e.g. `"home"`, `"ssg-ato-page"`). Submissions land in `leads` and also send a Gmail notification via the OAuth2 credentials stored in the vault. The lead-magnet conventions for this codebase (ICPs, form-field rules, page anatomy) are in [.claude/skills/lead-magnets/SKILL.md](.claude/skills/lead-magnets/SKILL.md).

### Design system

Dark sci-fi/robotics aesthetic. Tailwind 4 with `@theme` design tokens in [src/app/globals.css](src/app/globals.css) — colors are CSS vars consumed as `(--color-cyan)`, `(--color-purple)`, etc. Utility classes: `glass`, `card-hover`, `btn-primary`, `kicker`, `gradient-text`, `gradient-text-warm`, `glow-blob`. Fonts: Exo 2 (display), Inter (sans), JetBrains Mono (mono) — already loaded in [src/app/layout.tsx](src/app/layout.tsx) via `next/font`; do not re-import Google Fonts elsewhere. All UI work in this repo should follow [.claude/skills/frontend-design/SKILL.md](.claude/skills/frontend-design/SKILL.md).

## Deployment

Production runs on Coolify with the multi-stage [Dockerfile](Dockerfile) (Node 22 Alpine, Next `standalone` output). Pushing to `main` on GitHub triggers an auto-redeploy. Environment variables are managed in Coolify's UI, **not** committed.

Coolify env vars vs `.env`:
- Local `.env` and Coolify env should agree on `AUTH_SECRET` (required for cross-environment credential decryption) and `SYNC_API_TOKEN` (if using bearer auth for the sync API).
- `DATABASE_URL` differs per environment (Coolify provides its own; local points to localhost).
- `REMOTE_SYNC_URL` is local-only (used by the CLI to target prod).
- Everything else (Gmail OAuth, Anthropic token, lead-notification email) should live in `/admin/settings`, not env.

## Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes (adapted from [Andrej Karpathy's CLAUDE.md](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md)). Apply alongside the project-specific instructions above.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
