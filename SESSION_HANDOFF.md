# SESSION HANDOFF

> Point-in-time snapshot so a fresh session can resume without re-deriving
> everything. Last updated: 2026-10-19.
>
> This supersedes the 2026-10-04 handoff, which described an SMS-OTP auth
> flow and a Render deployment. Neither exists anymore: sign-in is Google
> OAuth, and production runs on Railway.

---

## 1. What Tilza is

A hosted storefront for small businesses. Sign-up creates a shop at
`/store/<slug>`; customers browse a shelved catalogue, fill a basket, and the
checkout hands the order to WhatsApp. Owners get orders, customers, catalogue,
ads and analytics in `/dashboard`.

Multi-tenant by `userId` ownership columns, not by role. One deployment serves
many shops.

---

## 2. Production

| Item | Value |
|---|---|
| Host | Railway, project `nurturing-simplicity`, env `production` |
| Web service | `tilo` |
| Database | `tilo-db` (private network only, no public domain) |
| URL | `https://tilo-production-81c6.up.railway.app` |
| Health | `/health` → `{"status":"healthy","db":true}` |
| Indexing | `SEO_INDEXABLE=true` (robots + llms.txt + sitemap are live) |
| Domain | None yet. Env-driven, so the cutover is config only — see README. |

Migrations run at **boot** (`prestart` → `scripts/boot-migrate.mjs`), not in the
build. Railway's build sandbox cannot reach the private Postgres network, so
`prisma migrate deploy` during build fails with `P1001`.

Local `.env.local` points `DATABASE_URL` at `localhost:5432`, which is
unreachable here (no local Postgres). Local dev is only good for static pages.

### Reaching the production database

The CLI's `railway run` injects the *private* host, which does not resolve from
a workstation. Use SSH instead:

```powershell
railway ssh -- "cd /app && node some-script.mjs"
```

`railway ssh -- echo ok` is enough to confirm access. For a script, base64 it
and write it inside the container:

```powershell
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content -Raw script.mjs)))
railway ssh -- "sh -c 'echo $b64 | base64 -d > /app/_tmp.mjs && cd /app && node _tmp.mjs; rm -f /app/_tmp.mjs'"
```

### Railway CLI linkage

```powershell
railway link --project 8cf56dee-231d-4775-ac24-935cac70b7a5 --environment production
railway service tilo
```

`railway link` takes `--project`, not `--project-id`.

---

## 3. Design system: one look

White canvas, blue structure, orange energy. No gradients, no dark mode, no
theme presets.

| Token | Value | Meaning |
|---|---|---|
| `--primary` | `#2563eb` | Structure: links, focus, primary UI |
| `--highlight` | `#f97316` | Energy: the one action per screen |
| `--highlight-foreground` | `#1c1917` | Text on orange (white is 2.8:1, too low) |
| `--highlight-strong` | `#c2410c` | Orange that passes with white text (5.2:1) |
| `--highlight-ink` | `#9a3412` | Orange as text on white |
| `--highlight-wash` | `#fff7ed` | Tinted surface |
| `--background` | `#ffffff` | Pure white |
| `--border` | `#e4e4e4` | Hairline |
| `--brand-h` / `--brand-c` / `--brand-l` | `257 / 0.19 / 0.62` | Blue seed |
| `--flame-h` / `--flame-c` / `--flame-l` | `45 / 0.21 / 0.62` | Orange seed |

- `src/lib/theme.ts` has a single `THEME_PRESETS` entry; `normalizeTheme()`
  collapses every legacy key to `'blue'`. The `Store.theme` column is kept.
- Dark mode is gone: no `next-themes`, no `.dark` block, no `data-theme` attr.
- The one surviving `repeating-linear-gradient` is `.tlz-scan` in
  `custom-style.css` (deliberate terminal texture).
- Logo slot: `brandLogo` in `src/lib/brand.ts:11`. Drop a file in `/public` and
  set the path; `TilzaLogo` swaps the wordmark for it automatically.

---

## 4. Auth

- Google OAuth only (`src/lib/auth.ts`, `src/lib/auth-config.ts`).
- `ADMIN_EMAIL` promotes exactly that account to platform `admin`; everyone else
  is `user`. Admin only unlocks the read-only monitor at `/dashboard/admin`.
- Per-shop access comes from `userId` ownership (`src/lib/ownership.ts`), never
  from the role.
- `SIGNUP_INVITE_CODE` gates non-Google sign-ups; `SIGNUP_LIMIT` caps accounts.

---

## 5. Gates

Run all four before committing:

```powershell
npm.cmd run typecheck
npm.cmd run lint     # biome, 0 errors + 15 pre-existing warnings
npm.cmd test         # vitest, 384 tests / 46 files
npm.cmd run build
```

`npm` must be `npm.cmd` in PowerShell (execution policy blocks `npm.ps1`).

CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests and build on
Node 24, then a Postgres integration job plus Playwright E2E.

---

## 6. Gotchas

- **PowerShell 5.1 encoding is a trap.** `Set-Content -Encoding UTF8` writes a
  BOM, and earlier sessions round-tripped UTF-8 through Windows-1252, which put
  real mojibake into 7 source files (the storefront search placeholder, the
  order-received copy, and several other customer-facing strings). Those were
  repaired in `f5d9472`. Write files with `[IO.File]::WriteAllBytes` or Node,
  and **never trust the PowerShell console** to judge encoding: it renders
  valid UTF-8 (em dashes, ellipses) as apparent mojibake too. Audit codepoints
  with Node.
- **No ternary in PowerShell 5.1.** `utf8NoBOM` is not a valid `-Encoding`.
- `git commit -m` mangles multi-line messages; use `git commit -F <file>`.
- Bracket paths (`src/app/store/[slug]/...`) need `Get-Content -LiteralPath`.
- CRLF phantom lint: keep `core.autocrlf false` / `core.eol lf`.
- Never junction `node_modules` between clones (Turbopack panics).
- `SKIP_ENV_VALIDATION=1` bypasses `src/lib/env.ts` for envless builds.
- `seed()` in `src/lib/seed.ts` is a no-op called from `instrumentation.ts`.

---

## 7. Open items

1. **Custom domain.** Not attached. All URLs are env-driven
   (`BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`),
   so cutover is config plus a Google OAuth redirect URI. Steps are in README
   under "Moving to a custom domain". The uptime workflow reads the optional
   `PRODUCTION_URL` repository variable and falls back to the Railway URL.
2. **`render.yaml` is legacy.** Marked as such; it provisions a free Postgres
   that Render deletes after 30 days. Delete it if Render will never be used.
3. **`SESSION_SUMMARY.md` is historical** (Sep 2026, includes the removed
   SMS-OTP flow). Kept as a log, not as current documentation.
4. **`/store/test`** was an empty "Test" shop created during deploy
   verification. It is now `active: false`, so `/store/test` returns 404 and it
   is absent from the sitemap and `llms.txt`. Restore with
   `prisma.store.update({ where: { slug: 'test' }, data: { active: true } })`
   or delete the row outright.
5. **Secrets.** `.env.local` is gitignored and has never been committed; the
   only secret-shaped strings in history are placeholders in `.env.example`.
   No rotation is required for that reason alone, but rotate normally if the
   file was ever shared.
