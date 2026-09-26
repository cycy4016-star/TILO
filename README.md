# Tilo

Tilo is your WhatsApp-led business operations workspace. It turns conversations,
notebooks, spreadsheets, and scattered files into one clear operating system:
customers, linked orders, and daily follow-up in a single authenticated dashboard.

Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn UI,
better-auth (phone + password with SMS OTP, optional email, admin roles),
Prisma 6 + PostgreSQL, Zod contracts, Biome, Vitest.

## What is included

- Marketing home at `/` (`src/app/(setup)/page.tsx`) with product sections.
- **Multi-tenant by account:** every sign-up gets its own shop. Customers,
  orders, catalogue, storefront, automations, notifications, payment
  transactions, and shop SMS all carry the owning account's `userId`, and every
  route filters on it — one deployment serves many businesses with no shared
  data. `FEATURES.md` §1 has the full map.
- Auth: phone-first login/signup/forgot-password/profile (`src/app/(auth)/**`).
  Sign-up collects name + phone + password (email optional), then confirms the
  number with an SMS OTP. Password resets go by SMS too. Session API at
  `/api/auth/*` (`src/app/api/auth/[...all]/route.ts`), `requireAuth` server gate
  for your own shop, `requireAdmin` for the platform monitor, `useSession` /
  `useIsAdmin` client hooks.
- SMS usage ledger + `SMS this month` dashboard card (`/api/dashboard/sms-usage`).
- Optional Paystack checkout for orders (`/api/payments/{initialize,verify,webhook}`).
- Dashboard at `/dashboard` with a customer directory, customer detail + linked
  orders, order creation, and status updates (`PENDING → PROCESSING →
  COMPLETED / CANCELLED`).
- Data plane: client pages call `/api/*` route handlers through `apiFetch`
  (`src/lib/api-client.ts`) with a shared Zod contract per resource
  (`src/lib/contracts/`). No Server Actions.
- Security headers in `next.config.ts` + per-request CSP nonce in `proxy.ts`.
- SEO plumbing: `src/lib/site.ts`, `robots.ts`, `sitemap.ts`, `manifest.ts`,
  default OG image, `/llms.txt`.

## Local development

Prerequisites: Node >= 20.18.1, npm, a PostgreSQL database.

```bash
cp .env.example .env.local
# fill in DATABASE_URL + better-auth vars, then:
npm install
npm run db:migrate:dev
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm run lint
npm run test
TEST_DATABASE_URL=postgresql://... npm run test:postgres
```

`npm run dev` and `npm run build` validate `DATABASE_URL` and
`NEXT_PUBLIC_APP_URL` unless `SKIP_ENV_VALIDATION=1` is set.

## Environment variables

See `.env.example` for the full list:

- `DATABASE_URL` — PostgreSQL connection string (required).
- `BETTER_AUTH_SECRET` — long random secret (required).
- `BETTER_AUTH_URL` — canonical app origin, e.g. `https://tilo.vercel.app`
  (required in production).
- `BETTER_AUTH_TRUSTED_ORIGINS` — optional comma-separated extra origins
  (preview deployments, custom domains).
- `ADMIN_EMAIL` / `ADMIN_PHONE` — optional. The account whose verified phone
  matches `ADMIN_PHONE` (preferred), or whose email matches `ADMIN_EMAIL`, gets
  the platform `admin` role; every other sign-up is a plain `user`. `admin` only
  unlocks the read-only account monitor at `/dashboard/admin` — it is not a
  per-shop role, and it grants no access to any shop's data. With neither var
  set, nobody is an admin. Already-promoted admins are never demoted.
- `SIGNUP_INVITE_CODE` — optional. When set, phone-first sign-ups must submit
  this exact invite code or they are rejected (Google/email-verified sign-ups
  are exempt). Pair with `NEXT_PUBLIC_SIGNUP_INVITE=true` so the sign-up form
  shows the field. Leave unset for open sign-up.
- `NEXT_PUBLIC_APP_URL` — public app origin for SEO/canonical URLs.
- `NEXT_PUBLIC_API_URL` — optional, only for an external API origin.
- `SEO_INDEXABLE` — set to `true` in production to allow indexing.

Google OAuth (optional — the alternative to phone + SMS):

- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — OAuth client from Google Cloud
  Console, with an authorized redirect URI of
  `https://<yourdomain>/api/auth/callback/google`.
- `NEXT_PUBLIC_GOOGLE_AUTH` — `true` to show the Google buttons on sign-in and
  sign-up (users then pick phone *or* Google as their verified identity).
  Without the keys the buttons stay hidden even if set to `true`.

Automation + SMS (all optional — the app boots without them):

- `CRON_SECRET` — bearer secret for the scheduler cron routes (see below).
- `SMS_PROVIDER` — `bms` | `arkesel` | `none` (default `none`).
- `BMS_API_KEY` — BMS Africa / mNotify API key (https://bms.africa), the active
  Ghana provider. OTP confirmation codes are routed as `sms_type: "otp"`.
- `BMS_SENDER_ID` — approved sender ID shown to recipients (defaults to `TILO`).
- `BMS_SMS_TYPE` — `otp` (default) or `bulk`. Use `bulk` when the account runs
  on free/bonus credits: the `otp` transactional route bills the paid wallet,
  while free credits only flow on the standard bulk route.
- `ARKESEL_API_KEY` / `ARKESEL_SENDER_ID` — Arkesel (https://arkesel.com),
  alternative provider switched via `SMS_PROVIDER=arkesel`.
- `SMS_SUMMARY_RECIPIENT` — phone (E.164 `+233...`) that gets the daily brief and the
  weekly pulse.
- `SMS_COST_PER_CREDIT_PESEWAS` — cost of one SMS credit, for the dashboard
  estimate (default `5`).

Email (optional — phone SMS is the primary verification/reset channel):

- `EMAIL_PROVIDER` — `resend` | `none` (default `none`).
- `RESEND_API_KEY` — Resend API key (https://resend.com).
- `EMAIL_FROM` — verified From address, e.g. `Tilo <no-reply@yourdomain.com>`.

Paystack (optional — order checkout returns `503` until configured):

- `PAYSTACK_SECRET_KEY` — secret key (https://paystack.com); enables the API.
- `PAYSTACK_PUBLIC_KEY` — public key (kept for future inline checkout).
- `PAYSTACK_CALLBACK_URL` — where Paystack returns the customer after checkout.

Scheduled automation routes, guarded by `Authorization: Bearer <CRON_SECRET>`:

- `POST /api/cron/rules` — run the automation sweep (nudges, flips, alerts, payment
  reminders, win-backs). Run it on whatever cadence you sell (hourly = tighter chasing).
- `POST /api/cron/daily-brief` — send this morning's one-text summary of yesterday.
- `POST /api/cron/weekly-summary` — send this week's pulse SMS.

## Deploy to Vercel + Postgres

1. Create a Postgres database (Neon, Supabase, or Vercel Postgres) and copy the
   connection string.
2. Push this repo to GitHub and import it in Vercel.
3. Build command: `prisma generate && prisma migrate deploy && next build`
   (already set as `npm run vercel-build`). Output directory: default.
4. Environment variables: set `DATABASE_URL`, `BETTER_AUTH_SECRET`,
   `BETTER_AUTH_URL` (your `https://...vercel.app` URL),
   `NEXT_PUBLIC_APP_URL` (same URL), `ADMIN_PHONE`, `SEO_INDEXABLE=true`, and the
   provider keys you use (`BMS_*`/`ARKESEL_*`, `RESEND_*`, `PAYSTACK_*`).
5. Deploy. `prisma migrate deploy` applies `prisma/migrations/*` before the
   Next build; the app seeds idempotently at boot (`src/lib/seed.ts`).

## Deploy to Render (blueprint)

`render.yaml` provisions a Node web service + managed PostgreSQL. In the Render
dashboard pick **New > Blueprint** and point it at this repo.

- `DATABASE_URL` is linked automatically from the provisioned database.
- Set `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `SMS_*`,
  `ADMIN_PHONE`, and the optional `RESEND_*` / `PAYSTACK_*` keys to real values
  after the first deploy (`sync: false` vars).
- `BETTER_AUTH_SECRET` is generated automatically.
- Store photos, the store logo, and profile avatars are stored in Postgres
  (no object storage), so they work on Render's ephemeral disk out of the box.
- Wire up `POST https://<app>/api/cron/rules` (daily), 
  `POST https://<app>/api/cron/daily-brief` (daily, morning),
  and `POST https://<app>/api/cron/weekly-summary` (weekly) with the `CRON_SECRET`
  header on cron-job.org / GitHub Actions.

Database workflows:

```bash
npm run db:generate        # regenerate Prisma client
npm run db:migrate:dev     # local migration during development
npm run db:migrate:deploy  # apply migrations (CI / production)
npm run db:studio          # inspect data
```

Upgrading an existing single-tenant install? `20260926120000_add_user_ownership`
adds the ownership columns, backfills every pre-existing row to the
earliest-created account (the original owner), then tightens the constraints —
back up first, and confirm the earliest account is the one you want to keep.

## Project structure

```text
prisma/
  schema/_base.prisma        Datasource + generator
  schema/auth.prisma         better-auth User/Session/Account/Verification
  schema/customer-order-workspace.prisma  Customer + Order models
  migrations/                Committed migration SQL
src/
  app/(setup)/page.tsx      Marketing home at /
  app/(auth)/               Login / signup / profile
  app/(dashboard)/dashboard Customers + customer detail + overview
  app/api/customers         Customer list/create/detail
  app/api/orders            Order list/create/status update
  app/api/auth/[...all]     better-auth handler
  lib/contracts/            Shared Zod contracts (customer, order)
  lib/auth.ts               better-auth server instance + role bootstrap
  lib/require-auth.ts       Server gate for signed-in users (their own shop)
  lib/require-admin.ts      Server gate for the platform admin monitor
  lib/require-admin-api.ts  API twin of the admin gate (403, never a redirect)
  lib/ownership.ts          Tenant lookups (requireOwnedCustomer/Order/…)
  lib/roles.ts              isAdminRole() — the single role check
  components/custom/        CustomerWorkspace, CustomerDetailWorkspace, OrderForm, SiteNav
  components/ui/            shadcn primitives
tests/unit                  Vitest (contracts, routes, tenant isolation, roles, CSP, SEO)
tests/integration           Postgres persistence (needs TEST_DATABASE_URL)
```

## License

MIT. See [LICENSE](./LICENSE).
