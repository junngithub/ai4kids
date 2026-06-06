---
name: frontend-design
description: Project-locked frontend design skill for the Tertiary Infotech CMS. Enforces a dark, sci-fi/robotics aesthetic matching www.tertiaryrobotics.com — Exo 2 + Inter typography, near-black backgrounds, cyan/purple/amber accents, animated glow gradients, hexagonal/grid motifs. Use whenever building or refining ANY UI in this repo.
---

# Tertiary Infotech — Dark Robotics Aesthetic

This skill is locked to ONE design direction. Do not invent new palettes, fonts, or moods. Match the aesthetic of **www.tertiaryrobotics.com**: dark sci-fi, agentic AI / physical AI / robotics undertones, premium-feel.

## Design tokens (LOCK these)

Already defined in [src/app/globals.css](src/app/globals.css). When adding/editing UI, reference these and NEVER introduce off-palette colors.

```
--color-bg:           #060A14   /* page background */
--color-bg-elevated:  #0C0D1A   /* cards, footer, nav */
--color-bg-glass:     rgba(255,255,255,0.04)
--color-border:       rgba(255,255,255,0.08)
--color-text:         #FFFFFF
--color-muted:        #AAA8B1
--color-accent-cyan:  #59EBFD
--color-accent-amber: #F6AE64
--color-accent-green: #01C982
--color-accent-purple:#5C00E5
--gradient-primary:   linear-gradient(90deg, #5C00E5 0%, #59EBFD 100%)
--gradient-warm:      linear-gradient(90deg, #F6AE64 0%, #59C09D 100%)
```

## Typography

- **Display / headings**: `Exo 2` (700/800/900). Tight tracking on huge hero text (-0.02em). Use uppercase for kicker labels with letter-spacing 0.2em.
- **Body / UI**: `Inter` (400/500/600).
- **Mono** (badges, code, kbd): `JetBrains Mono` or system mono.
- Never use Arial, Roboto, Open Sans, or system sans for body.

## Required visual language

Every section MUST include at least one of:

1. **Animated grid background** — 1px lines at 6% opacity using `linear-gradient` for x + y, optionally pan-animated.
2. **Glow blob** — large radial-gradient circles (cyan / purple) with `filter: blur(80px)` behind hero/section headlines.
3. **Hexagon / circuit accents** — `clip-path: polygon(...)` shapes, or SVG hex grids, for cards / badges.
4. **Gradient stroke buttons** — primary CTA = `--gradient-primary` filled with crisp inner border + slight glow shadow on hover.
5. **Kicker label** — small uppercase tag above headlines in mono, e.g. `[ AGENTIC AI · PHYSICAL AI ]`.

## Component patterns

- **Headlines**: huge (`clamp(2.5rem, 7vw, 6rem)`), `font-weight: 800`, white. Gradient-mask one keyword using `background-clip: text`.
- **Cards**: `background: var(--color-bg-elevated)`, border `1px solid var(--color-border)`, optional top hairline using `--gradient-primary`. Subtle hover lift (`translateY(-4px)`) + cyan glow border on hover.
- **Buttons**:
  - Primary: gradient-filled, rounded `0.6rem`, font-weight 600, slight shadow `0 0 40px rgba(89,235,253,0.25)`.
  - Secondary: transparent, 1px white/15 border, hover bg `white/5`.
- **Forms**: dark inputs (`bg-white/3`), focus ring cyan, never the default browser blue.
- **Icons**: prefer outline icons (Heroicons outline, Lucide). Apply cyan or amber color from the palette — never raw white-on-black icons.
- **Section padding**: `py-20 md:py-32`, generous breathing room.

## Motion

- Page load: stagger reveals using `animation-delay` (0ms / 80ms / 160ms / 240ms…) with `opacity` + `translateY(20px → 0)`.
- Hero gradient: animate `background-position` on the gradient text at 6–10s loop.
- Card hover: 200ms ease-out for transform + 300ms for border color.
- Never: bouncy springs, decorative parallax, gratuitous scroll-jacking.

## What NOT to do (these are bans)

- ❌ Light-mode sections. Everything is dark.
- ❌ Off-palette colors (no random reds, blues outside the accents, pastels).
- ❌ Inter for headlines. Inter is body only.
- ❌ Pure flat sections without a glow, grid, or texture.
- ❌ Emoji icons in production UI (only OK in admin/dev tooling).
- ❌ Generic SaaS hero with stock illustration + 3 service cards in a perfect row. Add asymmetry.

## When invoked

When asked to build or refresh a UI in this repo:

1. Re-read this file's tokens before writing CSS.
2. Pick the visual element required for the section (grid / blob / hexagon / gradient stroke).
3. Use Exo 2 for the headline class and Inter for everything else.
4. Add one stagger animation per section.
5. Stress-test on mobile (375px) — text never overflows, glow blobs are clipped via `overflow: hidden` on the section.

Reference site (open in browser to recall the vibe): https://www.tertiaryrobotics.com/
