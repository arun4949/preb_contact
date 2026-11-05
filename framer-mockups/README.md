# Framer mockups

Code components for the preb.co marketing site (Framer). Each file is one
self-contained React component: React only, inline styles, no Tailwind, no
imports from the app. The colors, type sizes, radii and the chip, avatar and
spinner looks mirror the Preb app's BoardUI theme in light mode, so the
mockups look like the product.

This folder is outside `src/`, so Next.js never compiles it.

## Paste into Framer

1. In Framer open **Assets → Code → Create code file**, name it after the file
   (for example `PrebWaterfallCard`), and replace the whole file content with
   the `.tsx` from this folder.
2. Drag the component from the Assets panel onto the page. Set its width to
   **Fill** (or a fixed width up to 480) and height to **Fit content**.
   The card is capped at 480px wide and centers itself in a wider frame.
3. Property controls appear in the right panel (see each component below).
4. On the canvas the component shows a static final state. Animations run in
   the preview and on the published site.

Fonts: the components use Inter and load it from Google Fonts themselves. If
the site already uses Inter as a Framer font, nothing else is needed.

## Components

### `PrebWaterfallCard.tsx`

Hero visual. Preb searches data sources one after another for one candidate:
personal email and cell first, work contacts kept only as fallback. Plays when
40% of the card is in the viewport, pauses when it leaves, and loops scenario
A (personal contacts found), then B (no personal email, work email promoted
as fallback), then A again.

Property controls: `Label` (text above the card, empty by default, which
hides it) and `Loop` (default on).

Layout follows the FullEnrich waterfall mockup in our design: avatar, name
and meta line, then two pill rows ("Personal": email and cell, "Work": email
and phone, dashed as fallbacks), then the provider rows with the provider's
logo in a circular badge joined by a connector line, status chips with
icons, a "20+ more data sources" placeholder row, and a footer with the
source count and credits. Scenario A names Apollo, Lusha, Hunter, People
Data Labs and ContactOut; scenario B names RocketReach, Kaspr, Prospeo and
Datagma. Logos are the providers' favicons loaded from Google's favicon
service (`google.com/s2/favicons`), with the first letter as fallback if a
logo fails to load.

Motion follows the co-founder's motion direction spec from the card entrance
onward: one master clock per scenario, only transform, opacity, clip-path and
background-color animate, every row and pill exists in the DOM from t=0 so
nothing shifts, connector lines draw 80ms before their row appears, chip
swaps slide 8px with the spec's easings, slot fills wipe in after a 100ms
fade, borders turn green at 300ms, fallbacks dim 200ms after the primary
fills, counters tween linearly with updates at most every 50ms, and rows exit
bottom to top with retracting connectors. Section 1 of that spec (eyebrow,
headline words, sticky stage) belongs to the Framer section itself, not to
this component.

Accessibility: honors `prefers-reduced-motion` (shows scenario A's final state
without spinners, no loop). The animated card is `aria-hidden`; one visually
hidden sentence describes the example. All data is fictional (example.com
addresses, 555 numbers), no vendor names or logos.

Size: 348px tall, up to 480px wide; 435px works. On screens narrower than
520px the card switches to auto height for phones.

Placement in the hero: replace the grey placeholder (a design component
called `waterfall_mockup`) with an instance of this code component. Set width
to Fill and height to Fit content. Fixed heights cut the card off.

#### Token mapping

The co-founder's spec used its own visual system (cream page, dark green,
Geist fonts, 2px corners with corner brackets). The structure, copy, timing
and animations of that spec are kept exactly; the surface is the app's.

| Role | Component value | BoardUI token (src/styles/theme.css) |
|---|---|---|
| Font | Inter, tabular numerals for data | `--font-sans` (the app has no mono font) |
| Text primary | `#0a0a0a` | text-primary (neutral-950) |
| Text secondary | `#737373` | text-secondary (neutral-500) |
| Text tertiary / muted / placeholder | `#a3a3a3` | text-tertiary (neutral-400) |
| Card surface | `#ffffff`, radius 20px, shadow `0 1px 1px rgba(0,0,0,.05)` | background-primary-default, rounded-3xl, shadow-card |
| Secondary surface (fallback slots, badges, footer) | `#f7f7f7` | background-secondary-default |
| Hairlines and dividers | `#ebebeb` | border-button-default, separator-border |
| Neutral chip | `#ebebeb` on `#737373` | Chip color "neutral" (background-tertiary-default) |
| Success chip, verified slot border | `#d9f99d` / `#3f6212` | status-lime (lime-200 / lime-800) |
| Warning chip | `#fef08a` / `#854d0e` | status-yellow (yellow-200 / yellow-800) |
| Row flash | lime-500 at 18% | chart-2-active |
| Avatar | 40px disc `#d4d4d4`, initials 13px/600 `#737373` | Avatar color "neutral" |
| Spinner | 14px SVG ring, track `#ebebeb`, arc `#404040`, 700ms per turn (spec) | ActiveLoader in enrichment-progress.tsx |
| Chip shape | radius 6px, padding 3px 6px, 12px/16px weight 500, letter-spacing .15px, sentence case | Chip variant "caption" |
| Labels (EXAMPLE LOOKUP, slot labels) | 12px/16px 500 | text-caption-1-medium |
| Name, source labels | 14px/20px 500 | text-body-medium |
| Meta line, values, footer | 13px/18px 400 | text-body-2-regular |

Values are sRGB hex equivalents of the theme's oklch values, so they render
identically in every browser Framer targets.

#### Spec adaptations

- No cream page color and no corner brackets: the card sits on whatever the
  Framer section provides.
- Chips use sentence case ("Profile found") like the app, not uppercase mono.
- Compact sizes so the whole scenario fits a 348px card: pills 24px in two
  rows, step rows 28px, footer 30px, avatar 32px.
- Scenario A has five named sources instead of six: the "Source 3" step
  (work phone fallback) is merged into Lusha's "Work email + phone · kept as
  fallback" and the later timestamps move 1100ms earlier (A is 15.6s).
- Real provider names and logos replace "Source 1, 2, 3". The spec's "no
  vendor names" line was overruled by the CTO on 2026-11-05.
- Status chips carry a check, cross or alert icon like the FullEnrich
  reference. Pills show their state by border color and text color only.

## Local preview

Bundle the file with esbuild (alias `framer` to a stub that exports
`addPropertyControls`, `ControlType` and `RenderTarget`) and render it in a
plain page. The components use `IntersectionObserver`, `ResizeObserver` and
the Web Animations API, all available in current browsers.
