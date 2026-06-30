---
description: Securely commit & push CODE to GitHub — scans for secrets/keys first (blocking), commits with this repo's conventions, pushes (branching off main when needed), and optionally opens a PR. Pushing to main auto-deploys the app via Coolify. (For pushing DB content to production, use /push-to-remote instead.)
argument-hint: "[pr]"
allowed-tools: Bash, Grep, Read, Glob
---

# /git-push

Securely ship code changes to GitHub. This is the **code/app** half of "publish"; the **DB-content** half is [/push-to-remote](push-to-remote.md). They are separate — this command never touches the sync API, and `/push-to-remote` never touches git.

**Deploy note:** pushing to **`main`** triggers a **Coolify auto-redeploy** of the production app (see [CLAUDE.md](../../CLAUDE.md) → Deployment). Treat a push to `main` as a production deploy.

**Argument:** pass `pr` (in `$ARGUMENTS`) to also open a pull request after pushing.

## Phase 1 — Secret scan (MANDATORY, blocking)

Never push secrets. Scan what's about to go up **before** any git write.

> Use the **Grep tool (ripgrep)** for pattern scanning — do NOT shell out to `grep` (this is a Windows + Git Bash/PowerShell box; `grep`/`ugrep` portability is a known headache, and the Grep tool is the sanctioned, reliable path).

1. List what's staged: `git diff --cached --name-only`. If nothing is staged yet, scan the files you intend to stage.
2. **Block sensitive files outright** — if any of these are staged, STOP: `.env`, `.env.*` (any env file), `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.keystore`, `*.jks`, `id_rsa`/`id_ed25519`, `credentials.json`, `secrets.json`, `.npmrc`, `.netrc`, `*.credentials.json`.
3. **Scan staged file contents** with the Grep tool for these patterns (case-insensitive where sensible). Run them as separate searches so one noisy hit doesn't hide others:
   - **This repo's own secrets (hard stops):**
     - `sk-ant-api` — Anthropic **API** keys are **banned everywhere** in this project (CLAUDE.md: only the `sk-ant-oat` OAuth token, and only in the encrypted DB store — never in code/env).
     - `sk-ant-oat` — the OAuth subscription token; must live in the credentials vault, never in a committed file.
     - `AUTH_SECRET\s*=\s*\S`, `SYNC_API_TOKEN\s*=\s*\S`, `GOOGLE_CLIENT_SECRET\s*=\s*\S` — load-bearing env secrets; only ever placeholders/empty in committed files.
     - `postgres(ql)?://[^\s"']*:[^\s"'@]+@` — a Postgres URL **with credentials** (`DATABASE_URL`).
     - Gmail/OAuth refresh + client secrets: `refresh[_-]?token`, `client[_-]?secret` followed by a real value.
   - **Generic credential assignments:** `(api[_-]?key|api[_-]?secret|secret|password|passwd|token|credential)\s*[:=]\s*['"][^'"]{8,}['"]` — a literal secret assigned in code.
   - **Private keys:** `-----BEGIN (RSA|DSA|EC|OPENSSH|PGP)? ?PRIVATE KEY-----` and `-----BEGIN PRIVATE KEY-----`.
   - **Vendor keys:** AWS `AKIA[0-9A-Z]{16}`; Google `AIza[0-9A-Za-z\-_]{35}`; Stripe `sk_live_`, `rk_live_`; Slack `xox[baprs]-`; GitHub `gh[pousr]_[A-Za-z0-9_]{36,}`; SendGrid `SG\.`.
   - **JWTs / bearer tokens:** `eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`, `bearer\s+[A-Za-z0-9._\-]{20,}`.
4. **`.gitignore` sanity:** confirm `.env` (and `.env.*`) are ignored. If not, that's a finding — fix it before pushing.

**If anything is found:** STOP. Report each hit as `file:line`, and remediate — move the value to `.env` (which must be gitignored), read it via `process.env.X` / the credentials vault per [src/lib/secrets.ts](../../src/lib/secrets.ts), and `git restore --staged <file>` to unstage. Never commit a real secret "temporarily."

**If clean:** report "🔒 Secret scan clean — no secrets staged" and continue.

> Note: a `.env.example`/`.env.sample` with **placeholder** values (e.g. `AUTH_SECRET=`) is fine — don't flag empty or obviously-fake values.

## Phase 2 — Commit & push

1. `git status` and `git diff --cached --stat` to confirm exactly what's going up.
2. **Stage explicitly** — list the files and `git add <paths>`. Never `git add -A` / `git add .` (it sweeps in stray files and secrets).
3. **Branch policy:** if you're on the default branch (`main`) and the user hasn't explicitly said to commit to `main`, create a feature branch first (`git switch -c <type>/<short-topic>`). Remember pushing `main` = a production deploy.
4. **Commit message:** conventional commits — `feat(scope): …`, `fix(scope): …`, `docs:`, `refactor:`, `chore:`, `style:`, `ci:` — derived from the actual diff. End the message with the trailer:
   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```
   (Do not use interactive flags — no `git commit` editor, no `git rebase -i`, no `git add -i`; they hang in this environment.)
5. **Push:** `git push origin <branch>` (use `-u` on a new branch). If rejected as non-fast-forward: `git pull --rebase origin <branch>` then push again. Never `--force` unless the user explicitly asks.

## Phase 3 — Pull request (only if `pr` in `$ARGUMENTS` or the user asks)

Use `gh`:
```bash
gh pr create --title "<conventional title>" --body "## Summary
- <what changed and why>

## Test plan
- [ ] npm run build passes
- [ ] smoke-tested the affected route(s) on http://localhost:3080

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
Target `main` unless told otherwise. Report the PR URL.

## Phase 4 — Report

Summarize: branch, commit hash + subject, push result, PR URL (if any), and **whether this deploys** — if pushed to `main`, note "→ Coolify will auto-redeploy production." Finally, remind: **code is now on GitHub, but production CMS/DB content is NOT** — if your change relies on new menus/settings/pages/posts, run [/push-to-remote](push-to-remote.md) to sync those too.

## What this command deliberately does NOT do

Unlike a generic "github push" workflow, it skips the portfolio-site steps that don't fit a private, server-backed product deployed via Coolify: no README/screenshot generation, no "Powered by …" footer injection, no editing the GitHub repo's About/topics/Discussions, and no GitHub Pages workflow (this app isn't static). Keep it to: scan → commit → push → optional PR.
