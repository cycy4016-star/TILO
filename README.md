# Tilza

Tilza is a hosted shop page for small businesses. A sign-up gets a shareable
catalogue at `/store/<slug>` — products grouped on shelves with photos,
prices (with a struck-through "before" where you discount), and a basket
customers fill themselves. Every checkout lands in the owner's dashboard as an
itemised, totalled order. WhatsApp is the order channel: the confirmation hands
the customer a pre-filled chat carrying the whole basket, and any product still
has one-tap WhatsApp and SMS. Around that: a customer directory, order history,
and sales analytics.

Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn UI,
better-auth (Google OAuth sign-in, admin roles),
Prisma 6 + PostgreSQL, Zod contracts, Biome, Vitest.

## What is included

- Marketing home at `/` (`src/app/(setup)/page.tsx`) with product sections.
- **Public storefront at `/store/[slug]`** (`src/app/store/[slug]/page.tsx`):
  shelved product groups, photos, price-before/price-now, catalogue search
  (name, description or shelf) with shelf filter chips, one-tap WhatsApp and
  SMS per item, and a multi-item basket that posts to
  `/api/public/store/[slug]/orders` — the confirmation then opens WhatsApp with
  the full basket pre-filled, so the shop gets the order on chat *and* in the
  dashboard. Hiding a shelf hides its products from the public page *and* from
  ordering.
- **Catalogue manager at `/dashboard/store`**
  (`src/components/custom/store-workspace.tsx`): shelf CRUD, product images,
  price pairs, active toggles, and a grouped catalogue list. The shelf id rides
  on `StoreItem.categoryId`; deleting a non-empty shelf is refused with a `409`
  so nothing is orphaned silently.
- **Ad Studio at `/dashboard/ads`** (`src/components/custom/ad-studio.tsx`): a
  fresh ready-to-post ad for every live listing, derived daily from the
  catalogue — headline, caption, hashtags and a `next/og` image in
  square/story/wide — posted with one tap to WhatsApp, Facebook, Instagram,
  TikTok, X or Telegram. A **multi-product ad** bundles several listings into
  one image, and **Post all at once** sends any subset as a campaign. Nothing is
  stored and no scheduler runs; the feed rotates on the UTC day key.
- **Multi-tenant by account:** every sign-up gets its own shop. Customers,
  orders, catalogue, storefront, notifications, and payment
  transactions all carry the owning account's `userId`, and every
  route filters on it — one deployment serves many businesses with no shared
  data. `FEATURES.md` §1 has the full map.
- Auth: Google-first login/signup/profile (`src/app/(auth)/**`). Accounts are
  created and identified through Google OAuth; a Google-verified email is the
  trusted credential. Session API at
  `/api/auth/*` (`src/app/api/auth/[...all]/route.ts`), `requireAuth` server gate
  for your own shop, `requireAdmin` for the platform monitor, `useSession` /
  `useIsAdmin` client hooks.
- Optional Paystack checkout for orders (`/api/payments/{initialize,verify,webhook}`).
- Dashboard at `/dashboard`: sales analytics (money owed, margins, product
  rankings), plus a customer directory, customer detail + linked
  orders, order creation, and status updates (`PENDING → PROCESSING →
  COMPLETED / CANCELLED`).
- Onboarding at `/welcome`: every new account sets up store info, socials,
  and logo/banner/avatar before the dashboard opens.
- Data plane: client pages call `/api/*` route handlers through `apiFetch`
  (`src/lib/api-client.ts`) with a shared Zod contract per resource
  (`src/lib/contracts/`). No Server Actions.
- Security headers in `next.config.ts` + per-request CSP nonce in `src/proxy.ts`.
- SEO plumbing: `src/lib/site.ts`, `robots.ts`, `sitemap.ts`, `manifest.ts`,
  default OG image, `/llms.txt`.

## Local development

Prerequisites: Node >= 24, npm, a PostgreSQL database.

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
- `BETTER_AUTH_URL` — canonical app origin, e.g. `https://tilza.org`
  (required in production).
- `BETTER_AUTH_TRUSTED_ORIGINS` — optional comma-separated extra origins
  (preview deployments, custom domains).
- `ADMIN_EMAIL` — optional. The account whose email matches this gets the
  platform `admin` role; every other sign-up is a plain `user`. `admin` only
  unlocks the read-only account monitor at `/dashboard/admin` — it is not a
  per-shop role, and it grants no access to any shop's data. Leave unset and
  nobody is an admin. Already-promoted admins are never demoted.
- `SIGNUP_INVITE_CODE` — optional. When set, sign-ups that are not from a
  fully-verified email (i.e. not Google) must submit this exact invite code or
  they are rejected. Leave unset for open sign-up.
- `SIGNUP_LIMIT` — optional. Hard cap on the number of accounts (the "first N
  shops" gate for a pilot). Sign-up is rejected once the cap is reached.
- `NEXT_PUBLIC_APP_URL` — public app origin for SEO/canonical URLs.
- `NEXT_PUBLIC_API_URL` — optional, only for an external API origin.
- `SEO_INDEXABLE` — set to `true` in production to allow indexing.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — optional Web
  Push credentials; generate with `npx web-push generate-vapid-keys`. Keep both
  keys stable across deploys.
- `CRON_SECRET` — optional bearer secret for `/api/cron/weekly-digest` and
  `/api/cron/dispatch-sweep`.

Google OAuth (the sign-in / sign-up identity):

- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — OAuth client from Google Cloud
  Console, with an authorized redirect URI of
  `https://<yourdomain>/api/auth/callback/google`.
- `NEXT_PUBLIC_GOOGLE_AUTH` — `true` to show the Google buttons on sign-in and
  sign-up. Without the keys the buttons stay disabled even if set to `true`.

Email (optional — password-reset links for credential accounts):

- `EMAIL_PROVIDER` — `resend` | `none` (default `none`).
- `RESEND_API_KEY` — Resend API key (https://resend.com).
- `EMAIL_FROM` — verified From address, e.g. `Tilza <no-reply@yourdomain.com>`.

Paystack (optional — order checkout returns `503` until configured):

- `PAYSTACK_SECRET_KEY` — secret key (https://paystack.com); enables the API.
- `PAYSTACK_PUBLIC_KEY` — public key (kept for future inline checkout).
- `PAYSTACK_CALLBACK_URL` — where Paystack returns the customer after checkout.

## Deploy to Railway + Postgres

Production runs on Railway: a `tilo` web service plus a `tilo-db` Postgres
service in the same project. The database has no public network access; only
the web service gets a public domain.

1. Create a Railway project with a Postgres service. Railway exposes its
   connection string as `DATABASE_URL`.
2. Point the web service at this repo. The service builds and starts with
   `npm run start`; `prestart` runs `scripts/boot-migrate.mjs`, which applies
   `prisma/migrations/*` before the server accepts traffic.
3. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
   `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GOOGLE_AUTH=true`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAIL`, and set
   `SEO_INDEXABLE=true` once the site is ready to be indexed.

Migrations deliberately run at **boot**, not during the build: Railway's build
sandbox cannot reach the Postgres private network, so `prisma migrate deploy`
in the build step fails with `P1001`. `prestart` runs where `DATABASE_URL`
actually resolves. `scripts/boot-migrate.mjs` also self-heals a previously
failed migration (`P3009`) before deploying again.

`src/app/store/[slug]/page.tsx` self-fetches through `BETTER_AUTH_URL`, and
SEO/canonical URLs come from `NEXT_PUBLIC_APP_URL`, so both must be the public
origin of the deployment.

### Moving to a custom domain

Nothing in the code is hardcoded to the Railway URL; the cutover is three
settings:

1. Attach the domain to the `tilo` service and point DNS at Railway.
2. Set `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and
   `BETTER_AUTH_TRUSTED_ORIGINS` (keep the old Railway URL in the trusted list
   during the transition).
3. Add `https://<domain>/api/auth/callback/google` to the Google OAuth client's
   Authorized redirect URIs, keeping the existing one until sign-in is verified.

`render.yaml` is retained for reference but is not used by the Railway
deployment.

Database workflows:

```bash
npm run db:generate        # regenerate Prisma client
npm run db:migrate:dev     # local migration during development
npm run db:migrate:deploy  # apply migrations manually (ops / recovery)
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
  schema/store.prisma        Store, StoreItem, ProductCategory (the catalogue)
  schema/customer-order-workspace.prisma  Customer + Order models
  migrations/                Committed migration SQL
src/
  app/(setup)/page.tsx      Marketing home at /
  app/(auth)/               Login / signup / profile
  app/(dashboard)/dashboard Analytics hub, catalogue, ads, orders, customers, admin
  app/store/[slug]/         Public storefront (no session)
  app/api/store/**          Shelf + product CRUD for the owner
  app/api/ads               Today's generated ad feed for the shop
  app/api/public/store/**   Read-only payload + basket checkout
  app/api/customers         Customer list/create/detail
  app/api/orders            Order list/create/status update
  app/api/auth/[...all]     better-auth handler
  lib/contracts/            Shared Zod contracts (store, category, order, …)
  lib/auth.ts               better-auth server instance + role bootstrap
  lib/require-auth.ts       Server gate for signed-in users (their own shop)
  lib/require-admin.ts      Server gate for the platform admin monitor
  lib/require-admin-api.ts  API twin of the admin gate (403, never a redirect)
  lib/ownership.ts          Tenant lookups (requireOwnedCustomer/Order/Category/…)
  lib/roles.ts              isAdminRole() — the single role check
  components/custom/        StoreWorkspace, StorePublish, CustomerWorkspace, SiteNav
  components/custom/storefront/  StoreCatalog, LeadCaptureCard
  components/ui/            shadcn primitives
tests/unit                  Vitest (contracts, routes, tenant isolation, roles, CSP, SEO)
tests/integration           Postgres persistence (needs TEST_DATABASE_URL)
```

## Web Push

Web Push is optional. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and a
`VAPID_SUBJECT` (`mailto:` or an origin), then redeploy. `/api/push/diagnose`
reports whether both keys are present and parseable without returning the
private key; the dashboard's notification card shows the same readiness state.

Real-device check (the part a build cannot prove):

1. Open the deployed site over HTTPS (or `localhost`) and sign in.
2. Go to the dashboard notification settings, choose **Turn on**, and allow
   notifications.
3. Press **Send a test notification** and confirm the operating system shows it
   while the tab is backgrounded or the installed app is closed.
4. If it does not arrive, check the OS notification permission, then
   `/api/push/diagnose`. A `404`/`410` from the push service removes that
   expired browser subscription automatically.

## Dispatch recovery

A local-delivery order starts its dispatch clock when the merchant broadcasts
the rider job. An in-process sweep checks every 20 seconds: after 90 seconds with no
rider it widens the radius by 5 km (minimum 10 km, maximum 50 km), and after two
minutes it writes a `DELIVERY_ATTENTION` bell notification and pushes the
merchant. A merchant pressing **Dispatch** again starts a fresh clock.

For deployments that sleep, set `CRON_SECRET` and call
`GET`/`POST /api/cron/dispatch-sweep` with
`Authorization: Bearer <CRON_SECRET>` from an uptime cron. The endpoint returns
`503` when the secret is unset and `401` for a wrong bearer token.

The compare-and-set updates in `src/lib/dispatch-sweep.ts` make concurrent
sweeps safe: only one worker widens or alerts for a given order.

## Delivery proof gallery

The operator proof gallery lives at `/dashboard/admin/proofs`. Only photos
uploaded by a buyer who ticked marketing consent appear there; each one is
`PENDING` until an operator approves or rejects it. Consent and moderation are
deliberately separate: approval does not grant consent, and consent alone does
not make a photo public.

## License

MIT. See [LICENSE](./LICENSE).
