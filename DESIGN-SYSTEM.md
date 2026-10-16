# Tilza design system — "Refined & premium"

Direction: **quiet surfaces, one confident accent, real typographic hierarchy.**
Think Linear/Stripe, not a poster. The gold is Tilza's signature, so it is used
precisely rather than in floods.

This document is the contract for UI work. The tokens below already exist —
reach for them instead of hand-rolling values.

---

## 1. Typography (the biggest single upgrade)

Two faces, loaded by `src/lib/fonts.ts`:

| Role | Font | CSS |
| --- | --- | --- |
| Display — headings, wordmark | **Bricolage Grotesque** | `font-display` |
| Body — UI, running text | **Inter** | `font-body` (default on `<body>`) |

Both are self-hosted by `next/font` at build time, so they are CSP-safe and
there is no layout shift on load. `h1`–`h6` already default to the display
face via the base rule in `custom-style.css`; `CardTitle` does too.

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
| `text-caption` | Meta, labels |

Rules:
- Headings get `font-display` (they already default to it via `--font-display`,
  but add it explicitly when overriding). **Body copy never gets `font-display`.**
- **Remove every `font-black`.** That's the Arial Black poster era. The scale
  already carries the right weight (720/700/680/640/600).
- **Remove `uppercase tracking-[0.25em]` / `tracking-[0.18em]` label blocks.**
  Replace with the `.text-eyebrow` utility (caption + semibold + `0.08em` +
  `text-brand-600`). It is already defined in `globals.css`.
- Body copy: `font-medium` at most for emphasis. Drop `font-bold`/`font-semibold`
  used on sentences.
- Long prose: cap at `max-w-[60ch]`.

## 2. Colour

The platform ships **neutral corporate**: slate-first surfaces, one restrained
accent, quiet backgrounds. The gold/ember ramps still exist as user picks in
the platform look picker, but no default surface may depend on them.

- ✅ `text-primary` for **one** key phrase per section, eyebrows, links, focus.
- ✅ `bg-primary text-primary-foreground` for the single primary CTA in a view.
- ❌ No gold-flooded panels, no `bg-primary/10` icon-tile farms repeated 6×.
- Surfaces do the layout work: `bg-card` on `bg-background`, hairline `border-border`.
- **Remove rainbow icon tiles** (`bg-sky-600`, `bg-emerald-600`, `bg-violet-600`).
  Use `bg-primary/10 text-primary`, or a neutral `bg-muted text-foreground`.
- **Remove hard-coded `dark:` literals** (`dark:bg-stone-950`, `dark:border-stone-800`,
  `dark:bg-stone-900`). They bypass the token system and break every `[data-theme]`
  preset. Use `bg-background`, `border-border`, `bg-card`, `text-muted-foreground`.
- **No `amber-*` literals anywhere.** The loud storefront branch is retired —
  every surface is corporate now.

## 3. Radius & elevation

Base radius is `0.625rem`, so:
`rounded-md` = 8px (buttons), `rounded-lg` = 10px, `rounded-xl` = 14px (cards),
`rounded-2xl` = 18px (large panels).

- Buttons: `rounded-md` by default — **do not override radius on buttons**.
- Cards: `rounded-xl` (14px).
- Clickable cards: add `.lift` (shared hover elevation) rather than a bespoke
  `hover:shadow-*` + `hover:-translate-y-*` pair.
- Shadows: `shadow-xs` … `shadow-2xl`, plus `shadow-brand`. Prefer
  `shadow-sm`/`shadow-md`; reserve `shadow-lg`+ for genuinely floating surfaces
  (dialogs, popovers get them free from the UI primitives).

## 4. Layout & rhythm

Available utilities:
- `.container-page` — centred, `max-w-72rem`, gutter padding.
- `.section` — `py-section px-gutter`.
- `.section-lg` — the big vertical breathing room.
- `py-section`, `px-gutter`, `--container-page`.
- `.text-eyebrow`, `.lift`.

Rules:
- **Alternate section tone** (`bg-background` → `bg-muted/40` → `bg-background`)
  instead of stacking `border-y` on every section.
- Section heading block: `.text-eyebrow` → `text-h2` → `text-body-lg` lead, left
  aligned, `max-w-[60ch]`.
- Dense UI gaps `gap-4`; marketing gaps `gap-6`/`gap-8`.
- Give one section `section-lg` for contrast — rhythm should not be uniform.
- Heading above cards sits on a row with the cards' top edge aligned, not floated
  arbitrarily.

## 5. Motion

- Easing tokens: `ease-out-expo`, `ease-spring`.
- Enter with `tw-animate-css` (`animate-in fade-in slide-in-from-bottom-4
  duration-500`) only where it clarifies hierarchy — not on every element.
- Always `motion-safe:` for decorative animation; respect reduced motion.
- Decorative noise to remove: floating blurred blobs, `animate-tilza-sheen`
  light sweeps, and multi-stop radial-gradient backgrounds behind heroes. At most
  **one** restrained radial accent, and only if it earns its place.

## 6. Retired poster-era markup (remove on sight, everywhere)

The loud storefront branch is retired — none of this may appear on any
surface anymore (it survives only as dead branches behind the always-true
`pro` flag until cleanup, and must not be reintroduced):

- `shadow-[3px_3px_0_0_…]`, `shadow-[4px…]`, `shadow-[5px…]`, `shadow-[6px…]`, `shadow-[8px…]`
- `rotate-[0.5deg]`, `-rotate-[0.5deg]`, `rotate-1`, `rotate-2`, `rotate-3`, `rotate-6`
- `rounded-[1.75rem]`, `rounded-[2rem]`, `rounded-[1.5rem]`
- `border-2`, `border-b-4`, `border-t-4` (use `border` = 1px)
- `border-amber-950`, `border-amber-700`
- `font-black`, `text-outline-cream`, `animate-marquee`

## 7. Primitives (`src/components/ui/`)

shadcn base (new-york style) plus four refinements that carry most of the
"this looks funded" weight. Reach for these before hand-rolling markup:

| Primitive | Notes |
| --- | --- |
| `Button` | Every variant has hover **and** an active press (`motion-safe:active:scale-[0.98]`), a 2px focus ring with offset, and `shadow-xs`. Sizes: `sm` `default` `lg` `xl` `icon`. **`xl` is for marketing CTAs only** — an oversized button inside a dense toolbar reads as a bug. |
| `Badge` | Adds `success` / `warning` / `info` / `neutral` status variants and a `dot` prop. Order, incident and feedback states all use these — do not invent a fifth colour recipe. |
| `Card` | `rounded-xl border shadow-sm`. `CardTitle` is set in `font-display`. |
| `EmptyState` | Icon + title + one line + the action that fills the void. Use it for **every** zero row — a bare "No results" is the fastest way to look unfinished. |
| `Stat` | Metric tile: label, value, optional delta. `delta.tone` is chosen by the caller — "up" is not universally good. |

Rules:
- Status colours use the **raw palette** (emerald/amber/sky), not the derived
  `--brand` ramp: success reads green whatever shop theme is active. Tints at
  ~12% opacity so a column of chips stays quiet.
- Never build a one-off empty state, metric tile or status chip inline.

## 8. Hard constraints

- **Do not edit** `src/app/globals.css` or `src/app/custom-style.css` — the
  foundation is set. If you think a token is wrong, say so in your report instead.
- **No new dependencies.** `lucide-react` icons only (already installed).
- **Do not change** data fetching, props, contracts, state, `id` anchors, route
  paths, `aria-*` labels, or user-facing copy (a heading may change only if the
  layout genuinely requires it — say so in your report).
- **Only edit the files assigned to you.**
- Gate with `npm.cmd run typecheck` and `npm.cmd run lint` (both must pass;
  note a pre-existing `noImgElement` warning in `store-catalog.tsx` is not yours
  to fix unless your brief says otherwise).
