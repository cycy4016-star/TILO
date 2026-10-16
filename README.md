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
- `NEXT_PUBLIC_APP_URL` — public app origin for SEO/canonical URLs.
- `NEXT_PUBLIC_API_URL` — optional, only for an external API origin.
- `SEO_INDEXABLE` — set to `true` in production to allow indexing.

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

## Deploy to Vercel + Postgres

1. Create a Postgres database (Neon, Supabase, or Vercel Postgres) and copy the
   connection string.
2. Push this repo to GitHub and import it in Vercel.
3. Build command: `prisma generate && prisma migrate deploy && next build`
   (already set as `npm run vercel-build`). Output directory: default.
4. Environment variables: set `DATABASE_URL`, `BETTER_AUTH_SECRET`,
   `BETTER_AUTH_URL` (your `https://...vercel.app` URL),
   `NEXT_PUBLIC_APP_URL` (same URL), `ADMIN_EMAIL`, `SEO_INDEXABLE=true`, and the
   provider keys you use (`GOOGLE_*`, `RESEND_*`, `PAYSTACK_*`).
5. Deploy. `prisma migrate deploy` applies `prisma/migrations/*` before the
   Next build; the app seeds idempotently at boot (`src/lib/seed.ts`).

## Deploy to Render (blueprint)

`render.yaml` provisions a Node web service + managed PostgreSQL. In the Render
dashboard pick **New > Blueprint** and point it at this repo.

- `DATABASE_URL` is linked automatically from the provisioned database.
- Set `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `GOOGLE_*`,
  `ADMIN_EMAIL`, `NEXT_PUBLIC_GOOGLE_AUTH=true`, and the optional `RESEND_*` /
  `PAYSTACK_*` keys to real values after the first deploy (`sync: false` vars).
- `BETTER_AUTH_SECRET` is generated automatically.
- Store photos, the store logo and banner, and profile avatars are stored in Postgres
  (no object storage), so they work on Render's ephemeral disk out of the box.

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

## License

MIT. See [LICENSE](./LICENSE).
