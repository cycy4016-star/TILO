# Tilza design system — marketplace energy

Direction: **warm orange, white product surfaces, dense but calm selling.**
Think a friendly marketplace, not a corporate landing page: product photos and
prices lead, promotions are bright, everything else is quiet. The orange is the
signature — use it for actions and offer bands, not as a background wash over
every section.

This document is the contract for UI work. The tokens below already exist —
reach for them instead of hand-rolling values.

---

## 1. Typography (the biggest single upgrade)

One family, two roles, loaded by `src/lib/fonts.ts`:

| Role | Font | CSS |
| --- | --- | --- |
| Display — headings, wordmark | **Inter 700–760**, tight tracking | `font-display` |
| Body — UI, running text | **Inter** | `font-body` (default on `<body>`) |

Inter is self-hosted by `next/font` at build time, so it is CSP-safe and there
is no layout shift on load. Both roles resolve to Inter: hierarchy comes from
the type scale's size, weight and tracking, not a second novelty face.
`h1`–`h6` already default to the display role via the base rule in
`custom-style.css`; `CardTitle` does too.

**Use the type scale.** One class carries size + line-height + weight + tracking,
so never compose `text-4xl font-bold leading-tight tracking-tight` by hand:

| Token | Use for |
| --- | --- |
| `text-display` | Hero headline, one per page |
| `text-h1` | Page title |
| `text-h2` | Section heading |
| `text-h3` | Sub-section / large card title |
| `text-h4` | Card title |
| `text-body-lg` | Lead paragraph under a heading |
| `text-body` | Default copy |
| `text-small` | Supporting copy |
| `text-caption` | Meta, labels, price fine print |

Rules:
- Headings get `font-display` (they already default to it via `--font-display`,
  but add it explicitly when overriding). **Body copy never gets `font-display`.**
- The display face already carries the weight. Avoid `font-black`.
- Eyebrows use `.text-eyebrow` (caption + semibold + letter spacing). Do not
  invent new letter-spaced label recipes.
- Body copy: `font-medium` at most for emphasis. Drop `font-bold`/`font-semibold`
  used on sentences; weights are for prices, counts and actions.
- Long prose: cap at `max-w-[60ch]`.

## 2. Colour

The platform ships **one warm marketplace look**: an off-white canvas, white
cards, near-black ink and two oranges. There is no user-facing theme picker.

| Token | Approx. | Meaning |
| --- | --- | --- |
| `--primary` | `#cf4a00` | Actions, links, focus, active nav |
| `--primary-foreground` | white | Text on primary (4.5:1+) |
| `--highlight` | `#fb7701` | Promo bands, sale CTAs, badges |
| `--highlight-foreground` | `#241205` | Text on highlight (7:1+) |
| `--highlight-ink` | dark ember | Orange text on light surfaces |
| `--highlight-wash` | `#fff5ec` | Quiet orange tint for icon tiles/cards |
| `--background` | warm off-white | Page canvas |
| `--foreground` | `#171717` | Primary ink |
| `--destructive` | red | Discounts, urgency, destructive actions |

Rules:
- ✅ `text-primary` for links, prices, counts, active states and eyebrows.
- ✅ `bg-primary text-primary-foreground` for the main action in a view.
- ✅ `bg-highlight text-highlight-foreground` for small promo strips, badges and
  high-energy CTAs. Keep the dark ink; white on bright orange does not pass.
- ✅ `bg-highlight-wash` for large hero/promo panels; keep big surfaces quiet and
  ink-first.
- ✅ `bg-highlight-wash text-primary` for icon tiles and small feature accents.
- ❌ Do not flood whole pages with orange. Solid `highlight` is for small
  accents; large panels stay wash or white, and the rest is white cards on the
  canvas.
- Surfaces do the layout work: `bg-card` on `bg-background`, hairline
  `border-border`.
- Status colours use the raw palette (emerald/amber/sky/red) so success always
  reads green and errors read red, regardless of the orange brand.
- No gradients beyond the deliberate terminal scanline; no dark mode.
- Legacy `[data-theme]` / `--tl-*` variables stay for stored shop keys, but every
  preset renders this same warm ramp.

## 3. Radius & elevation

Base radius is `0.5rem`:

- `rounded-md` = 6px (buttons, inputs, small controls)
- `rounded-lg` = 8px (cards, dialogs, panels)
- `rounded-xl` = 12px (large marketing/auth panels only)

Rules:
- Buttons: `rounded-md` by default — **do not override radius on buttons**.
- Cards: `rounded-lg`, white, hairline border. Avoid stacked drop shadows.
- Clickable cards: add `.lift` (shared hover elevation) rather than a bespoke
  `hover:shadow-*` + `hover:-translate-y-*` pair.
- Shadows: flat by default. `shadow-sm` only for genuinely floating surfaces
  (dialogs, popovers, sticky bars) and `shadow-lg` for the mobile basket bar.
- Product images take the top corners: `rounded-t-[7px]` inside a `rounded-lg`
  card so the hairline border stays crisp.

## 4. Layout & rhythm

Available utilities:
- `.container-page` — centred, `max-w-80rem`, gutter padding.
- `.section` — `py-section px-gutter`.
- `.section-lg` — the big vertical breathing room.
- `py-section`, `px-gutter`, `--container-page`.
- `.text-eyebrow`, `.lift`.

Rules:
- **Alternate section tone**: `bg-background` → `bg-card` → `bg-background`.
  Avoid stacking `border-y` on every section.
- Section heading block: `.text-eyebrow` → `text-h2` → `text-body` lead, left
  aligned, `max-w-[60ch]`.
- Dense merchant UI gaps `gap-4`; marketing gaps `gap-6`/`gap-8`.
- Landing heroes can split copy and a 2×2 product preview; keep the preview
  inside the content column at every width.
- Product grids: 2 columns on phones, 3 from `md`, 4 from `xl`; keep prices and
  discount badges visible without hover.
- Merchant dashboards use compact page headers (eyebrow + `text-h2` + one
  action), then data cards.

## 5. Motion

- Easing tokens: `ease-out-expo`, `ease-spring`.
- Enter with `tw-animate-css` (`animate-in fade-in slide-in-from-bottom-4
  duration-500`) only where it clarifies hierarchy — not on every element.
- Always `motion-safe:` for decorative animation; respect reduced motion.
- Product cards may lift or scale their image on hover; do not animate prices,
  counts or status chips.

## 6. Retired poster-era markup (remove on sight, everywhere)

- `shadow-[3px_3px_0_0_…]`, `shadow-[4px…]`, `shadow-[5px…]`, `shadow-[6px…]`, `shadow-[8px…]`
- `rotate-[0.5deg]`, `-rotate-[0.5deg]`, `rotate-1`, `rotate-2`, `rotate-3`, `rotate-6`
- `rounded-[1.75rem]`, `rounded-[2rem]`, `rounded-[1.5rem]`
- `border-2`, `border-b-4`, `border-t-4` (use `border` = 1px)
- `border-amber-950`, `border-amber-700`
- `font-black`, `text-outline-cream`, `animate-marquee`
- Blue/indigo/slate brand literals (`bg-blue-600`, `text-slate-500`)

## 7. Primitives (`src/components/ui/`)

| Primitive | Notes |
| --- | --- |
| `Button` | Semibold by default; hover **and** an active press, 2px focus ring with offset. Variants: `default`, `highlight` (bright orange, dark ink), `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes: `sm` `default` `lg` `xl` `icon`. **`xl` is for marketing/product CTAs only** — an oversized button inside a dense toolbar reads as a bug. |
| `Badge` | Status variants `success` / `warning` / `info` / `sale` / `neutral` and a `dot` prop. Use these rather than inventing a fifth colour recipe. |
| `Input` | `h-10`, `rounded-md`, orange focus border + soft ring. |
| `Card` | `rounded-lg border bg-card`; no shadow by default. `CardTitle` uses the display face. |
| `EmptyState` | Icon + title + one line + the action that fills the void. Use it for **every** zero row. |
| `Stat` | Metric tile: label, value, optional delta. `delta.tone` is chosen by the caller — "up" is not universally good. |
| `Dialog` / `Sheet` | `rounded-lg`, `bg-black/60` overlay, no double shadows. |

Rules:
- Status colours use the **raw palette** (emerald/amber/sky/red): success reads
  green whatever the surface. Tints at ~10–12% so a column of chips stays quiet.
- Never build a one-off empty state, metric tile or status chip inline.

## 8. Terminal exception

`/dashboard/admin/*` keeps its own dense ops-console skin, driven by the `--t-*`
vars in `custom-style.css`. It is still warm ink-on-white with orange structural
accents, monospace type and square corners. Do not apply marketing spacing or
rounded marketing panels there.

## 9. Hard constraints

- **Do not edit** `src/app/globals.css` or `src/app/custom-style.css` unless the
  task is explicitly a foundation change. If a token is wrong, say so in your
  report instead.
- **No new dependencies.** `lucide-react` icons only (already installed).
- **Do not change** data fetching, props, contracts, state, `id` anchors, route
  paths, `aria-*` labels, or user-facing copy (a heading may change only if the
  layout genuinely requires it — say so in your report).
- Gate with `npm.cmd run typecheck` and `npm.cmd run lint` (both must pass; a
  pre-existing `noImgElement` warning in `item-gallery-editor.tsx` is not yours
  to fix unless your brief says otherwise).
