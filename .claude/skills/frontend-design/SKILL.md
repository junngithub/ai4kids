---
name: frontend-design
description: Project-locked frontend design skill for the AI Kids portal. Enforces the bright, playful kid aesthetic used across the public site and the /learn games — Fredoka + Nunito typography, cream/white backgrounds, coral/sky/mint/grape/sunny accents, rounded cards, soft shadows, emoji icons, gentle hover/float motion. Use whenever building or refining any public-facing or learner UI in this repo. (The dark robotics theme is scoped ONLY to the /admin back-office — see the note at the bottom.)
---

# AI Kids — Bright & Friendly Aesthetic

This skill is locked to ONE design direction for everything a child or parent sees: the public marketing pages and the `/learn` games, activities, and escape rooms. Think **warm, rounded, chunky, joyful** — a kid should feel like they're playing, not using software. Do not invent new palettes, fonts, or moods.

> There is a second, SEPARATE dark theme for the admin back-office (`.admin-shell`). Never mix the two. If you're building anything under `/learn`, `/login`, `/dashboard`, the landing page, or any kid/parent screen, you are in THIS theme.

## Design tokens (LOCK these)

Defined in [src/app/globals.css](src/app/globals.css) under `@theme`. Reference these as Tailwind colors (`bg-coral`, `text-sky-600`, `ring-mint/30`, `bg-cream`) and never introduce off-palette colors.

```
--color-cream:     #fff8ee   /* default page background (html/body) */
--color-coral:     #ff6b6b   /* PRIMARY action / brand pop */
--color-sky:       #38bdf8   /* secondary / info / links */
--color-mint:      #34d399   /* success / correct / "go" */
--color-grape:     #a855f7   /* playful purple accent */
--color-bubble:    #ec4899   /* pink accent */
--color-sunny:     #ffd23f   /* yellow highlight / stars */
--color-tangerine: #fb923c   /* orange accent */
```

Build cards on **white** (`bg-white`) over the cream page. Use `slate-800/900` for headings and `slate-500/600` for body text on white. Accents are used as soft tints (`bg-grape/15 text-grape`) and rings (`ring-grape/30`), not flat fills, except on buttons.

## Typography

- **Display / headings / buttons**: `font-fun` (Fredoka) — `font-700`, friendly and rounded. This is the personality font; use it for titles, button labels, scores, game names.
- **Body / paragraphs / supporting copy**: `font-round` (Nunito) — `font-500/600`.
- **Mono** (`font-mono`, JetBrains Mono): ONLY for room codes / tokens (e.g. a join code like `LION42`). Never for body.
- Never use Exo 2, Inter, Arial, or system sans for kid UI — those belong to the admin theme.

## Required visual language

Kid/public UI should feel rounded, soft, and tactile. Reach for these:

1. **Big rounded corners** — `rounded-3xl` or `rounded-[2rem]` for cards/panels, `rounded-full` for buttons, pills, and avatars/badges.
2. **Soft shadows + hairline rings** — `shadow-sm` (resting) / `shadow-lg` (raised), with `ring-1 ring-slate-100` or `ring-amber-100`. No hard borders.
3. **Emoji as icons** — emoji are ENCOURAGED here (🧠 🃏 🔢 🎲 🦦 🚀 ⭐ 🎉). Put a big emoji in a tinted rounded tile (`flex h-14 w-14 items-center justify-center rounded-2xl bg-grape/15 text-3xl`).
4. **Bright gradient banners** — soft pastel gradients for headers/heroes, e.g. `bg-gradient-to-r from-bubble/30 to-sky/30` or `from-sky/20 via-cream to-coral/20`. Keep them light, never neon.
5. **Per-feature accent colour** — each game/section picks one accent (coral / sky / mint / grape / bubble) and uses it consistently for its tile, ring, and highlights.

## Component patterns (Tailwind recipes — there are no kid-specific CSS utility classes)

- **Headings**: `font-fun text-2xl font-700 text-slate-900` (page titles bigger). Taglines: `font-round text-slate-500`.
- **Cards**: `rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100`. Hover lift: add `transition hover:scale-[1.02]` or `card-hover`-style `hover:-translate-y-1` (write it inline; the `.card-hover` class is dark-theme).
- **Primary button**: `rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow transition hover:scale-105`. This coral pill is THE call to action.
- **Secondary button**: `rounded-full bg-slate-100 px-5 py-2.5 font-fun font-700 text-slate-600 hover:bg-slate-200`. Or a soft-tinted accent (`bg-sky px-4 py-2 text-white`).
- **Selectable tiles / answer cards**: white with `ring-1 ring-slate-200`; selected = `scale-[1.05] bg-<accent> text-white ring-2 ring-<accent>/60`.
- **Forms / inputs**: `rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-3 font-round text-lg outline-none focus:border-coral`. Big, rounded, friendly — never tight admin inputs.
- **Success / error feedback**: success = `bg-mint/20 text-emerald-700 ring-1 ring-mint/40`; gentle error/nudge = `bg-coral/10 text-coral ring-1 ring-coral/20`. Keep error copy kind ("So close! Try again 🙂"), never harsh.
- **Pills / badges**: `rounded-full bg-slate-50 px-3 py-1 font-fun text-xs font-700 text-slate-500 ring-1 ring-slate-100`.

## Motion

- **Hover**: `transition hover:scale-105` (buttons) / `hover:scale-[1.02-1.03]` (cards). Snappy and inviting.
- **Idle delight**: gentle bob/float on decorative emoji via the `float` / `er-float` keyframes already in globals.css — small amplitude, slow. Stars/confetti on a win are welcome.
- **Tone**: bouncy and playful is GOOD here (the opposite of the admin theme). Keep it readable and not nauseating — no scroll-jacking, no fast strobing.

## What NOT to do (bans)

- ❌ The dark/admin palette in kid UI — no cyan (`#59EBFD`), purple (`#5C00E5`), `glass`, `btn-primary`, `kicker`, `gradient-text`, near-black backgrounds. Those are admin-only.
- ❌ Exo 2 / Inter for kid headings or body. Use `font-fun` + `font-round`.
- ❌ Hard borders, sharp corners, tiny dense controls. Everything is big, rounded, breathable.
- ❌ Cold/clinical copy or scary red error states. Be warm and encouraging.
- ❌ Off-palette colours (random teals, hot magentas) outside the token set above.
- ❌ Low contrast — keep headings `slate-800/900` on white so kids can read easily.

## When invoked

When asked to build or refresh a public/kid/learner UI:

1. Re-read the tokens above; build on `bg-white` cards over the `cream` page.
2. Pick ONE accent colour for the feature and use it for its emoji tile, ring, and selected state.
3. `font-fun font-700` for titles/buttons, `font-round` for body.
4. Round everything (`rounded-3xl` / `rounded-full`), add `shadow-sm ring-1`, and a `hover:scale` on interactive elements.
5. Add an emoji or two for warmth, and a gentle hover/float.
6. Stress-test on mobile (375px): tap targets ≥ 44px, text never overflows, cards stack cleanly.

Good references already in the repo: the Brain Arcade hub ([src/app/learn/cards/page.tsx](src/app/learn/cards/page.tsx)), the card game player, the escape-room player, and the unified login ([src/app/login/page.tsx](src/app/login/page.tsx)).

---

### Note: the dark robotics theme still exists — but ONLY for admin

The near-black, cyan/purple sci-fi aesthetic (Exo 2 + Inter, `glass`, `btn-primary`, `gradient-text`, `grid-bg`, `glow-blob`, `.prose-dark`) is scoped to **`.admin-shell`** (the `/admin` back-office) and CMS/blog prose. It is real and intentional — do NOT delete it — but it is the wrong theme for anything a child or parent sees. Only reach for it when working inside `/admin`.
