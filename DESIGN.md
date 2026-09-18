# Payround DESIGN.md

Inspired by **[Asteria Fintech App · HorizonX](https://horizonx.so/explore/asteria-app)** — celestial fintech language: dark navy, ice-blue glow, white primary CTAs, soft glass, starfield ambient.

## Palette

| Role | Value |
|------|--------|
| Deep navy | `#080b1a` |
| Mid navy | `#121c3a` |
| Ice accent | `#7dd3fc` / glow `#38bdf8` |
| Primary CTA | White `#ffffff` on dark (ink `#080b1a`) |
| Sheet / lists | Near-white bottom sheets |
| Glass | Navy translucent + ice border ~14% |

## Typography

- **UI:** Manrope
- **Display / balances:** Syne (geometric, bold) — large money-style figures
- Kickers: uppercase, wide tracking, ice accent

## Components

- Primary actions: **white rounded-full** pills (Asteria signature)
- Active nav / mode: white fill + dark ink (not pink)
- Cards: ~28px radius, frosted navy glass
- Content lists: light `.pr-sheet` panels against dark chrome
- Floating dock sidebar + detached mobile nav pill

## Motion

Page blur-in, list stagger, spring pills, star twinkle. Honor `prefers-reduced-motion`.

## Layout

Asymmetric login (orbit headline left / form right). App content left-aligned; balance figures dominate where money is shown.
