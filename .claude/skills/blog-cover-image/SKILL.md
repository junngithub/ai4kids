---
name: blog-cover-image
description: Generate the branded SVG cover image for a blog post on the Tertiary Infotech Academy CMS. Use when adding, editing, or debugging the AI-rendered featured image — anything that changes the canvas size, padding, fonts, colors, layout, or upload path. Triggers — "blog cover", "featured image", "post image", "cover card", "OG image", "regenerate image", or any change to `src/app/api/ai/post-image/route.ts`, `src/components/admin/PostEditorForm.tsx` (image branch), or how `featuredImage` is rendered on `/blog` and `/blog/[slug]`.
---

# Blog Cover Image — Tertiary Infotech Academy

The site renders a branded SVG card for every blog post's featured image. It is generated server-side by `sharp`, uploaded to Cloudflare R2, and referenced by the post's `featuredImage` URL. This skill is the contract every change to that pipeline must respect.

## TL;DR rules

Every change to the cover image must obey **all** of these:

1. **Canvas = 1200 × 750** (16:10). Do not use 1200×630 — the blog index uses `aspect-[16/10]`, so anything wider gets center-cropped and clips the title.
2. **Horizontal safe padding = 100 px on each side** (`PADDING_X = 100`). All text and the brand footer must start ≥100px from the left edge and end ≤1100px from the left.
3. **Vertical safe padding = ~80 px top/bottom.** The kicker sits ~60px above the title block; the brand footer is anchored ~75px from the bottom.
4. **Font family = `sans-serif`** (no Inter, Exo 2, JetBrains Mono). `sharp`/libvips's SVG renderer **does not have webfonts available** — anything other than a generic CSS family falls back silently to a wider default and breaks the safe-area assumptions.
5. **Title font auto-sizes**. Use `fitFontSize(title)` — never hardcode the title size. The helper probes 80→32px and re-wraps the title so the longest line fits within `WIDTH - 2*PADDING_X`.
6. **Title is at most 3 lines.** `wrapTitle()` ellipses anything that would spill past line 3.
7. **Brand colors**: bg gradient `#0a0118 → #1a0533 → #020611`; purple glow `#5C00E5`; cyan accent `#59EBFD`. No other hues — these are the site's design tokens.
8. **Output = PNG**, content-type `image/png`, key `blog/ai-<timestamp>-<slug>.png`, uploaded via `uploadToR2()`.

## Where the code lives

- **Renderer** — [src/app/api/ai/post-image/route.ts](src/app/api/ai/post-image/route.ts)
  - `POST { query, slug, kicker? }` → JSON `{ ok, url, bytes }`.
  - Title is `query`; kicker is shown as `[ KICKER ]` above the title.
  - Admin-only via `isAdminRequest`.
  - Returns 400 if R2 isn't configured.
- **Trigger from editor** — [src/components/admin/PostEditorForm.tsx](src/components/admin/PostEditorForm.tsx)
  - Called automatically after "Generate full post" when Claude returns a title.
  - The "✨ AI Regenerate Image" button on the Featured image card re-runs it with the current title + suggested category as the kicker.
- **Consumed in** — [src/app/blog/page.tsx](src/app/blog/page.tsx) (list, inside `<div className="aspect-[16/10] overflow-hidden">`) and [src/app/blog/[slug]/page.tsx](src/app/blog/[slug]/page.tsx) (post detail, full bleed).

## SVG anatomy (mental model)

```
0 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1200
│   ──── 2px cyan top border ────                       │
│                                                       │
│   100 ─→  [ AI AUTOMATION ]   (kicker, cyan mono 20)  │
│                                                       │
│   100 ─→  Why Kajima Chose                            │
│           AI Governance                                │
│           Training in 2026   (title, sans-serif 64)   │
│                                                       │
│                                                       │
│   ┌──┐   Tertiary Infotech Academy                    │
│   │TI│   tertiaryinfotech.com   (brand, sans 18 / 13) │
│   └──┘                                                │
0 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 750
```

Background = `#0a0118→#1a0533→#020611` diagonal gradient, with a `#5C00E5` purple glow at top-left and a `#59EBFD` cyan glow at bottom-right, plus a 40-px cyan grid pattern at 0.08 opacity.

## Helpers you must reuse

- `fitFontSize(title)` → `{ fontSize, lineHeight, lines }`. Picks the largest font where every line fits in `SAFE_TEXT_WIDTH`. Uses a `0.58 × fontSize` char-width heuristic — calibrated for libvips's default sans. Don't tune the heuristic without testing 5+ real titles of varying lengths.
- `wrapTitle(title, maxCharsPerLine, maxLines=3)` — packs words greedily; ellipses overflow.
- `escapeXml(s)` — every dynamic string must go through this before being interpolated into the SVG.

## Things that have broken before — do not undo

- **Custom font names (Inter, Exo 2, JetBrains Mono).** Reverted because libvips silently falls back. Stick with `sans-serif` and `monospace`.
- **1200×630 canvas.** Looked fine on the post detail page but center-cropped on the blog index, clipping the leading title letter. Always 1200×750.
- **Hardcoded 68px title size.** Long titles overflowed `SAFE_TEXT_WIDTH`. Always go through `fitFontSize`.
- **Padding < 100 px.** Even with the 16:10 fix, lower padding leaves no breathing room for the kicker pill and the brand footer's logo.
- **Tavily image search.** Removed because (a) images were copyright-unknown, (b) style was inconsistent, (c) latency was 2-3s per call. The SVG path is free, instant, and on-brand — do not reintroduce Tavily for the cover.

## When you change the SVG

1. Update `route.ts` and re-run `npx tsc --noEmit`.
2. Smoke-test with **three** title lengths: short (≤ 25 chars), medium (~50 chars), long (≥ 80 chars). Verify the leading letter and the trailing word are both ≥ 30 px from the canvas edge on each.
3. Hit `/admin/posts/<id>/edit` → click **✨ AI Regenerate Image** → confirm:
   - The image preview in the editor shows complete left and right padding.
   - The blog index card (in another tab at `/blog`) shows the full title with no clipped letters.
4. The R2 URL pattern is immutable — `blog/ai-<timestamp>-<slug>.png` — anything that scans old paths must keep working.

## Adding a new layout variant

If you need a different layout (e.g. quote card, code-card, listicle hero), prefer **a new endpoint** like `/api/ai/post-image-quote` over branching the existing one. The current endpoint is one-shape-fits-all by design; multiple shapes belong in sibling routes that share the same R2 upload path.
