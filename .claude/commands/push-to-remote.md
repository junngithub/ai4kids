---
description: Push local CMS DB content (menus, settings, taxonomy, pages, posts) to production via the sync API.
argument-hint: [resource...|all]
---

# /push-to-remote

Push local Postgres rows to the production database through the bearer-token sync API (`/api/admin/sync/*`).

**Arguments**: `$ARGUMENTS` — one or more of `menus`, `settings`, `taxonomy`, `pages`, `posts`, or `all`. If empty, default to a guided flow: show the user what's locally different and ask which resources to push.

## Workflow

1. **Sanity-check env**. Confirm both `REMOTE_SYNC_URL` and `SYNC_API_TOKEN` are present in the local `.env`. If either is missing, explain the setup steps from [.claude/skills/remote-db-sync/SKILL.md](../skills/remote-db-sync/SKILL.md) and stop.

2. **Show a preview** of what will change before pushing. For each requested resource:
   - `menus` — list the local header/footer items (label + href) that will *replace* remote.
   - `settings` — list local setting keys that will be upserted.
   - `taxonomy` — count of categories and tags.
   - `pages` / `posts` — list slugs + statuses (published / draft / archived) that will be upserted.

   Use small SQL via `psql` or a `db.select()` snippet through `npx tsx` to gather the preview.

3. **Confirm with the user** before doing any destructive operation. `menus` is destructive (it replaces remote items) — always ask explicitly:
   > "This will replace all remote `<location>` menu items with the local set. Continue?"

   For upserts (`settings`, `taxonomy`, `pages`, `posts`), confirm only when pushing >10 rows or `all`.

4. **Run the push**:
   ```bash
   npx tsx scripts/push-to-remote.ts $ARGUMENTS
   ```
   Stream the script output verbatim to the user. The script runs resources in dependency order (`taxonomy → settings → menus → pages → posts`) regardless of argument order.

5. **Verify**. After a successful push, hit a public production URL to spot-check (`curl -sI https://www.tertiaryinfotech.com/` for nav, or fetch a specific page's HTML and grep for the new content). Report back the verification result.

## Safety rules

- **Never** push without showing the preview. Silent overwrites of production content destroy trust.
- **Never** push if the user appears to have been editing production via the admin UI — that work could be overwritten. Ask first.
- **Never** sync `users`, `leads`, or `media` through this command. They're explicitly out of scope (see the skill).
- If a push fails partway through, surface the exact endpoint that 4xx'd. Don't retry blindly — investigate the root cause (FK ordering, token mismatch, missing menu shell on remote).

## Examples

```
/push-to-remote menus
/push-to-remote taxonomy posts
/push-to-remote all
```
