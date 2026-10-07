# Tilo — Feature Inventory

Tilo is a hosted shop page for small Ghanaian/African businesses. Sign up, put
your products on shelves with photos and prices, share one link, and let
customers check out a basket from `/store/<slug>` — the order lands itemised and
totalled in your dashboard. Around that core sit a customer directory, order
history, sales analytics and card checkout, all behind
one authenticated dashboard.

This document lists **everything the app does today**, what each piece is for,
where it lives, and what is deliberately not built yet.

---

## 1. Tenancy & deployment model

- **One shop per account (multi-tenant, one database).** There is no
  `Workspace`/`Organization` model — the `User` row *is* the shop. Every business
  row carries a `userId` pointing at the account that owns it, and every route
  filters on that column, so N sign-ups share one deployment without ever seeing
  each other's data.
  - `Customer.userId`, `Order.userId`, `Store.userId` (`@unique` — one
    storefront per account), `Notification.userId`.
  - `SmsUsage.userId` is **nullable and has no FK**: sign-up OTPs are sent before
    an account exists. It is a write-only ledger for verification codes — there
    is no usage UI.
  - `StoreItem`, `Promotion` and `SocialAccount` have no `userId` of their own —
    they are reached *through* their store (`store: { userId }`), so a guessed
    cuid cannot be resolved against another shop.
  - Public storefront writes (`/api/public/store/[slug]/*`) resolve the owner
    from the slug's `Store` row and stamp it; the request body can never choose
    the owner.
  - The `userId` columns are internal routing and are never returned to the
    client (the response contracts in `src/lib/contracts/` don't declare them).
- **Cross-shop reads are deliberate and few:** `/dashboard/admin` +
  `/api/admin/users` (the operator's account monitor, `admin` role only).
  Everything else is owner-scoped.
- The app is designed to run on Vercel or Render with a managed PostgreSQL
  database. `render.yaml` provisions both automatically.
- Seeding is idempotent and runs at boot (`src/lib/seed.ts`); it is an
  intentional no-op today, so a fresh database boots clean and empty.
- **Existing deployments:** migration
  `20260926120000_add_user_ownership` adds the columns nullable, backfills every
  pre-existing row to the earliest-created account (the original owner of the
  single-tenant install), then tightens to `NOT NULL`.

---

## 2. Identity & access

**Location:** `src/lib/auth.ts`, `src/lib/auth-config.ts`,
`src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`,
`src/app/(auth)/**`, `src/lib/require-auth.ts`, `src/lib/require-admin-api.ts`.

- **Phone-first authentication.** Phone number is the primary verified identity
  for phone accounts; email is optional. **Google OAuth** is an alternate
  identity path users can pick instead (email verified by Google, no phone
  required). The method the user picks when signing up decides which
  identifiers are required for that account.
- **Sign-up** (`/signup`, `src/components/custom/sign-up-form.tsx`):
  1. Name + phone + password (+ optional email). Email is required by
     better-auth internally, so when the user skips it we synthesize
     `<e164digits>@phone.tilo`.
  2. `signUp.email` creates the user and a session.
  3. `phoneNumber.sendOtp` sends a 6-digit code over SMS.
  4. `phoneNumber.verify({ updatePhoneNumber: true })` attaches the phone to the
     signed-in user, marks `phoneNumberVerified`, and signs in.
- **Sign-in** (`/login`, `src/components/custom/sign-in-form.tsx`): phone +
  password via `signIn.phoneNumber` (requires a verified phone —
  `requireVerification: true`), **or** "Continue with Google"
  (`signIn.social` → `socialProviders.google`, shown when
  `NEXT_PUBLIC_GOOGLE_AUTH=true` + both Google keys are set).
- **Google sign-up/sign-in** (`src/components/custom/sign-up-form.tsx`): the
  Google button skips the phone+OTP steps entirely — Google's verified email is
  the identity. Phone-first users keep the SMS OTP flow. No phone is required
  for Google accounts (and SMS password reset does not apply to them).
- **Password reset** (`/forgot-password`,
  `src/components/custom/forgot-password-form.tsx`): SMS-first —
  `requestPasswordReset` sends a code, `resetPassword` sets the new password.
  Email reset links are an optional fallback, used only when an email provider is
  configured (`auth-config.ts → sendResetPassword`).
- **Invite-code gate (optional).** When `SIGNUP_INVITE_CODE` is set, phone-first
  sign-ups must submit the exact code or better-auth aborts the user creation in
  the `user.create.before` hook (`src/lib/auth.ts`). The code arrives as an
  `inviteCode` additional field on `User`. Google/email-verified sign-ups are
  exempt (the identity is already trusted). The sign-up form shows the field
  when `NEXT_PUBLIC_SIGNUP_INVITE=true`. Leave the env empty for open sign-up.
- **Platform admin role.** The better-auth `admin` plugin is enabled, but the
  role is a **platform** role, not a per-shop one. Every sign-up is created as
  `role: "user"` (`defaultRole` + the `user.create.before` hook in
  `src/lib/auth.ts → resolveRole`); only the account whose verified phone matches
  `ADMIN_PHONE` (preferred) or whose email matches `ADMIN_EMAIL` is promoted to
  `"admin"`. Both env vars are optional — with neither set nobody is an admin and
  the monitor is simply unreachable. **Pre-existing admins are left untouched.**
  What `admin` grants is exactly one thing: reading `/dashboard/admin` and
  `/api/admin/users`. It grants no shop access, because shops are separated by
  the `userId` columns, not by a role.
- **Server gates:** `requireAuth()` (any signed-in user — the gate for a shop's
  own data) and `requireAdmin()` / `requireAdminUser()` (platform-admin only:
  redirect `/dashboard` in a Server Component, throw a 403 `Response` in a route
  handler — never redirect a fetch). Both check the role via the shared
  `isAdminRole()` helper in `src/lib/roles.ts`. Client-side gating uses
  `useSession()` / `useIsAdmin()`, the latter reading `data.user.role`.
- **Profile** (`/profile`): shows name, phone, and (only when set) real email;
  avatar upload/capture/remove (stored on `User.image` as a data URL); sign-out.

---

## 3. Dashboard

**Location:** `src/app/(dashboard)/dashboard/page.tsx`,
`src/components/custom/dashboard/**`,
`src/app/api/dashboard/**`.

- **Overview metrics** (`/api/dashboard/overview`): outstanding money, count of
  unpaid orders, age of the oldest unpaid order, money recovered this month.
- **Money to chase card**: top outstanding orders, one tap to jump in.
- **Balance sheet**: cost vs sell and realized order-line margins
  (`/api/dashboard/intelligence`).
- **Product ranking**: per-item volume, revenue, cost and margin
  (`/api/dashboard/products`).
- **Navigation shell**: links to Analytics, Catalogue, Orders, Customers.

---

## 4. Customers

**Location:** `src/app/(dashboard)/dashboard/customers/**`,
`src/components/custom/customer-workspace.tsx`,
`src/components/custom/customer-detail-workspace.tsx`,
`src/app/api/customers/**`, `src/lib/contracts/customer.ts`.

- Directory with search (`?q=`) across name/company/email/phone.
- Create customers (name required; company, email, phone, address optional).
- Customer detail page: profile, contact actions (WhatsApp via `wa.me`, phone,
  email, map), and the linked order timeline.
- Per-customer order count and order history.

---

## 5. Orders

**Location:** `src/app/api/orders/**`, `src/lib/contracts/order.ts`,
`src/components/custom/order-form.tsx`.

- Create an order against a customer (description, optional amount in pesewas).
- Status lifecycle: `PENDING → PROCESSING → COMPLETED / CANCELLED`, editable
  inline.
- Auto order numbers: `TILO-YYYYMMDD-XXXXXXXX`.
- Payment tracking: `amountPesewas` (whole pesewas, no floats) and `paidAt`.
- Mark-paid action records a manual payment; the Paystack flow records an online
  one.

---

## 6. Payments (Paystack)

**Location:** `src/lib/paystack.ts`, `src/lib/payments.ts`,
`src/lib/contracts/payment.ts`,
`src/app/api/payments/{initialize,verify,webhook}/route.ts`,
`src/components/custom/customer-detail-workspace.tsx`.

- **Optional and safe when unconfigured.** With no `PAYSTACK_SECRET_KEY` the
  routes return `503` and the rest of the app is unaffected. There is **no
  paywall** — the app is fully usable before billing is switched on.
- **Collect payment** button on an unpaid order:
  1. `POST /api/payments/initialize` creates a `PaymentTransaction` (PENDING) and
     returns a Paystack `authorization_url`; the browser redirects there.
  2. `GET /api/payments/verify?reference=...` verifies with Paystack and settles
     the order (the fast path after checkout).
  3. `POST /api/payments/webhook` is the source of truth: verifies the
     HMAC-SHA512 `x-paystack-signature` over the raw body, then settles on
     `charge.success`.
- **Settlement is idempotent** (`src/lib/payments.ts`): a reference that is
  already `SUCCESS` never regresses; order `paidAt` is only set once.
- Statuses: `PENDING | SUCCESS | FAILED | ABANDONED`. Amounts are GHS pesewas.

---

## 7. Analytics hub

**Location:** `src/app/(dashboard)/dashboard/page.tsx`,
`src/components/custom/dashboard/money-to-chase-card.tsx`,
`src/components/custom/intelligence-workspace.tsx`,
`src/components/custom/products-workspace.tsx`,
`src/app/api/dashboard/{overview,intelligence,products}/route.ts`.

- **One screen for the numbers.** `/dashboard` combines what used to be three
  pages: money owed (`MoneyToChaseCard` over `/api/dashboard/overview`),
  the margin balance sheet (`IntelligenceWorkspace` over
  `/api/dashboard/intelligence`: cost vs sell, realized order-line margins),
  and the product ranking (`ProductsWorkspace` over `/api/dashboard/products`:
  per-item volume, revenue, cost, margin). The two workspaces render with
  `hideIntro` so the hub keeps a single `h1`.
- There is no automation engine, no scheduler and no SMS dashboard: the
  `AutomationRule` / `AutomationEvent` tables were dropped in
  `20261007141706_prune_to_catalogue_core`, with the rules API, the cron
  routes and the switchboard UI.

---

## 8. SMS (BMS Africa / mNotify)

**Location:** `src/lib/sms.ts`, `src/lib/env.ts`, `prisma/schema/sms.prisma`.

- **Provider:** BMS Africa / mNotify (`SMS_PROVIDER=bms`, the active Ghana
  provider; Arkesel remains available via `SMS_PROVIDER=arkesel`). One JSON
  endpoint, Ghanaian sender IDs. OTP confirmation codes are sent with
  `sms_type: "otp"` by default (transactional route that avoids DND but bills
  the paid wallet); accounts running on free/bonus credits set
  `BMS_SMS_TYPE=bulk` so codes ship on the standard route (see `src/lib/env.ts`).
  A send that BMS reports as fully rejected (DND /
  unprovisioned number) is recorded as a failure rather than a silent success.
  `sendSms(to, message, source)` never throws and returns `{ ok, providerRef, error }`.
- **Verification codes only.** SMS exists to deliver sign-up OTPs (and password
  resets). There is no bulk sender, no composer and no usage UI.
- **Usage ledger.** Every attempt (success or failure) is written to the
  `SmsUsage` table with segment count, credits, provider reference, and error.
  Nothing reads it back today — it is an audit trail.
- **Segment estimation:** `ceil(length / 160)`.

---

## 9. Email (optional)

**Location:** `src/lib/email.ts`, `src/lib/auth-config.ts`.

- Provider-agnostic transport (Resend wired via HTTP, no SDK).
- `sendEmail()` never throws; returns `{ ok, providerRef, error }`.
- Used only for password-reset links when `EMAIL_PROVIDER=resend` +
  `RESEND_API_KEY` are set. SMS remains the primary channel.
- Swap vendors by changing `EMAIL_PROVIDER` and the one transport function.

---

## 10. Store / catalogue + public storefront

**Location:** `src/app/(dashboard)/dashboard/store/page.tsx`,
`src/app/store/[slug]/page.tsx`, `src/components/custom/store-workspace.tsx`,
`src/app/api/store/**`, `src/app/api/public/store/[slug]/route.ts`,
`src/lib/contracts/store.ts`, `src/lib/whatsapp-templates.ts`.

- Manage a store: name, slug (URL-safe), tagline, description, contact phone,
  active toggle, and a **logo** (capture or upload).
- **Shelves (`ProductCategory`)** group the catalogue: name, sort order, active
  toggle, and a live item count. A product picks a shelf
  (`StoreItem.categoryId`, nullable) or sits unshelved. Renaming onto a shelf
  that already has that name returns `409`; deleting a shelf with products on it
  returns `409` with the count, and deleting an empty one clears the products'
  `categoryId`.
- Catalogue **items** as `PRODUCT` or `SERVICE`, each with name, description,
  price (pesewas), an optional **compare-at "was" price** for discounts, the
  shelf it sits on, sort order, active flag, and a **photo** (capture or upload).
- **Images live in Postgres** (`Store.logo`/`StoreItem.image` bytea columns) and
  are served read-only by public routes — no object storage, so they survive
  Render's ephemeral disk and deploy with no extra setup. Photos are compressed
  client-side (canvas, ~1280px JPEG) before upload and capped server-side (item
  5 MB, logo/avatar 2 MB).
- **Public storefront** at `/store/<slug>` served by
  `/api/public/store/<slug>`: items grouped under shelf headings in `sortOrder`
  order, unshelved products under "Everything else". Only `active` shelves and
  their products are exposed — hiding a shelf hides its products from the page
  *and* from ordering, and draft/inactive items never appear. The hero shows the
  logo and shelf cards show item photos.
- **Catalogue search & shelf filter:** the storefront grid is a client island
  with a search box that matches item name, description *and* shelf name (typing
  a category brings back everything filed under it), plus one chip per shelf and
  an "All items" reset. Filtering only hides cards — the basket always spans the
  whole catalogue — and reports an "N of M items" count with a clear-filters
  escape hatch and a "No matches" empty state.
- **Multi-item basket:** each product card carries an add button and a quantity
  stepper; a sticky bar totals the basket and opens a checkout dialog that POSTs
  `{ lines, customerName, phone, note }` to `/api/public/store/<slug>/orders`.
  That one rate-limited request prices every line, refuses items that are hidden,
  inactive or no longer shelved, and requires a dialable phone number (at least
  9 digits) before it will create a customer row. It writes an `Order` plus one
  `OrderLineItem` per line, then the confirmation screen hands the order to
  **WhatsApp**: a receipt with the order number and a pre-filled `wa.me` message
  (`src/lib/whatsapp-templates.ts`) carrying every line, the total, the
  customer's name and number, and the note. Products also keep one-tap
  per-item WhatsApp and SMS links, and the shop owner is notified as the order
  arrives.
- Store dashboard (`store-workspace.tsx`) shows photo thumbnails on shelf cards
  and supports replace/remove for logo, banner and item photos in their forms.

---

## 11. Socials as contact info

**Location:** `src/app/api/store/socials/route.ts`,
`src/lib/contracts/social.ts`, `src/app/welcome/page.tsx`.

- Collected once at onboarding (`/welcome`, step 2): the networks the shop is
  on, each with the owner's handle and an optional profile link.
- Platforms: `TIKTOK`, `INSTAGRAM`, `FACEBOOK_PAGE`, `WHATSAPP_STATUS`.
- One row per platform per shop (`@@unique([storeId, platform])`), saved as a
  batch and editable by revisiting `/welcome`. There is no publishing queue.

---

## 12. API surface

All routes own their data; client pages call them through `apiFetch` with a
shared Zod contract (`src/lib/contracts/`). No Server Actions.

Every `user` row below means *the signed-in account's own shop* — the handler
filters on `userId` (or resolves the owner from the store) and a foreign id
returns 404. See §1.

| Method(s) | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `*` | `/api/auth/[...all]` | public | better-auth (sign-up, sign-in, OTP, reset) |
| `GET/POST` | `/api/customers` | user | list/search, create |
| `GET` | `/api/customers/[customerId]` | user | read (with orders) |
| `GET/POST` | `/api/orders` | user | list (customer/status/free-text search), create |
| `PATCH` | `/api/orders/[orderId]` | user | update status/amount/paidAt |
| `GET` | `/api/dashboard/overview` | user | money/order metrics |
| `GET` | `/api/dashboard/intelligence` | user | balance sheet: cost vs sell, realized order-line margins |
| `GET` | `/api/dashboard/products` | user | per-item sales volume, revenue, cost, margin |
| `GET` | `/api/notifications` | user | live activity feed + unread count |
| `POST` | `/api/notifications/read` | user | mark all notifications read |
| `GET/PUT` | `/api/store` | user | read/upsert the store (payload includes shelves) |
| `GET/POST` | `/api/store/categories` | user | list shelves (with item counts), create |
| `PATCH/DELETE` | `/api/store/categories/[categoryId]` | user | rename/reorder, toggle active, delete (`409` when non-empty) |
| `GET/POST` | `/api/store/items` | user | list/create catalogue items |
| `PATCH/DELETE` | `/api/store/items/[itemId]` | user | update/delete item |
| `PUT/DELETE` | `/api/store/items/[itemId]/image` | user | attach/remove item photo |
| `GET/POST` | `/api/store/promotions` | user | list/create promotions |
| `PATCH/DELETE` | `/api/store/promotions/[promoId]` | user | update/delete promotion |
| `PUT/DELETE` | `/api/store/promotions/[promoId]/image` | user | attach/remove promo photo |
| `PUT/DELETE` | `/api/store/logo` | user | attach/remove store logo |
| `PUT/DELETE` | `/api/store/banner` | user | attach/remove storefront banner |
| `GET/PUT` | `/api/store/socials` | user | list/replace the shop's social accounts |
| `PUT/DELETE` | `/api/profile/image` | user | set/clear profile avatar |
| `GET/PUT` | `/api/appearance` | user | the signed-in user's own theme + layout preset (not the storefront's look — that is `Store.theme`/`Store.appearance` via `/api/store`) |
| `GET` | `/api/public/store/[slug]` | public | public storefront |
| `POST` | `/api/public/store/[slug]/orders` | public + rate-limit | multi-line basket checkout (auto-adds customer) |
| `POST` | `/api/public/store/[slug]/leads` | public + rate-limit | visitor capture with consent |
| `GET` | `/api/public/store/items/[itemId]/image` | public | item photo bytes |
| `GET` | `/api/public/store/promotions/[promoId]/image` | public | promotion photo bytes |
| `GET` | `/api/public/store/[slug]/logo` | public | store logo bytes |
| `GET` | `/api/public/store/[slug]/banner` | public | storefront banner bytes |
| `POST` | `/api/payments/initialize` | user | start Paystack checkout |
| `GET` | `/api/payments/verify` | user | verify + settle a transaction |
| `POST` | `/api/payments/webhook` | signature | Paystack webhook (source of truth) |
| `GET` | `/api/admin/users` | admin | platform account monitor (cross-shop, read-only) |

---

## 13. Data model

**Location:** `prisma/schema/*.prisma`.

- **Auth:** `User` (with `phoneNumber` unique + `phoneNumberVerified`, `role`,
  `inviteCode`, and the reverse ownership relations `customers`, `orders`,
  `store`, `notifications`), `Session`, `Account`,
  `Verification`.
- **Shop data (every row owned):** `Customer` (`userId`), `Order` (`userId`),
  `Notification` (`userId`).
- **Store:** `Store` (`userId` **unique** — one storefront per account;
  `logo`/`logoMime` + `banner`/`bannerMime` bytea), `ProductCategory` (shelf: name, sortOrder, active),
  `StoreItem` (`PRODUCT`/`SERVICE`, `pricePesewas`, `compareAtPricePesewas`,
  `categoryId` nullable with `onDelete: SetNull`, sortOrder, active,
  `image`/`imageMime` bytea), `Promotion`, `SocialAccount` — the last four are
  reached through their `store`, not by their own `userId`.
- **SMS:** `SmsUsage` (`userId` nullable, no FK — see §1), `source`, `to`,
  `message`, `segments`, `credits`, `ok`, `providerRef`, `error`, `createdAt`.
- **Payments:** `PaymentTransaction` (`reference` unique, `orderId`, amount,
  currency, status, email, authorizationUrl, providerRef, raw).

Migrations live in `prisma/migrations/` and are applied with
`prisma migrate deploy`.

---

## 14. Security

- Per-request CSP nonce + security headers (`src/proxy.ts`, `src/lib/csp.ts`,
  `next.config.ts`).
- **Tenant isolation is the `userId` column, not a role.** Every read filters on
  it and every write is guarded by it: a foreign `id` 404s instead of resolving.
  Writes that could race (`order.update`) key on `(id, userId)`, so even a
  forged action can't flip another shop's order.
- `userId` is never accepted from a request body on a create, and never
  serialized to the client.
- `requireAuth()` gates shop routes (401 signed out); `requireAdmin()` /
  `requireAdminUser()` gate the two cross-account routes (redirect / 403). The
  Admin nav entry is hidden from non-admins, with the page re-checking.
- The Paystack webhook is authenticated by HMAC-SHA512 signature over the raw
  body, compared in constant time, and settles only the order its reference was
  issued against.
- Secrets live only in env; `.env.local` is git-ignored, `.env.example` ships
  placeholders.

---

## 15. Platform plumbing

- SEO: `src/lib/site.ts`, `robots.ts`, `sitemap.ts`, `manifest.ts`, default OG
  image, `/llms.txt`.
- Health check at `/health`.
- `apiFetch` (`src/lib/api-client.ts`) validates every response against its Zod
  contract at runtime, catching client/server drift.

---

## 16. Configuration (env)

See `.env.example` for the annotated list.

- **Required:** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
  (production), `NEXT_PUBLIC_APP_URL`.
- **Owner:** `ADMIN_PHONE` (preferred) / `ADMIN_EMAIL`; invite gate via
  `SIGNUP_INVITE_CODE` + `NEXT_PUBLIC_SIGNUP_INVITE=true`.
- **Verification SMS:** `SMS_PROVIDER` (`bms` | `arkesel` | `none`),
  `BMS_API_KEY`, `BMS_SENDER_ID`, `BMS_SMS_TYPE`, `ARKESEL_API_KEY`,
  `ARKESEL_SENDER_ID`.
- **Email (optional):** `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`.
- **Paystack (optional):** `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`,
  `PAYSTACK_CALLBACK_URL`.
- **Google OAuth (optional):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
  client-side `NEXT_PUBLIC_GOOGLE_AUTH=true`.

You can verify a BMS key + sender ID by signing up with `SMS_PROVIDER=bms` and
checking the `SmsUsage` rows (a failed send records `ok: false` with the
provider error instead of a silent drop).

---

## 17. Operations

- **Local:** `npm install`, `npm run db:migrate:dev`, `npm run dev`.
- **Checks:** `npm run typecheck`, `npm run lint`, `npm run test`.
- **DB:** `db:generate`, `db:migrate:dev`, `db:migrate:deploy`, `db:studio`.
- **Deploy:** Vercel (`vercel-build` runs `prisma generate && prisma migrate
  deploy && next build`) or Render (`render.yaml`). No schedulers — there are
  no cron routes.

---

## 18. Testing

- Vitest unit/integration suite: contracts, route handlers, tenant
  isolation (foreign customer/order/item 404s, cross-shop phone reuse,
  owner-stamped public captures, notification ownership), the platform
  role policy, onboarding gate, CSP, nav, store, promotions, live-orders,
  sms + whatsapp templates, instrumentation, SEO text.
- Postgres integration tests via `npm run test:postgres` (needs
  `TEST_DATABASE_URL`).

---

## 19. Deliberately not built (yet)

- **Accounts/roles beyond `user` + platform `admin`** — no shop-level
  teammate seats, invites, or per-shop roles yet; one account = one shop.
- **WhatsApp Business API** — contact links use `wa.me`; no Cloud API sending.
- **Social publishing** — socials are contact info only; the app never posts to
  TikTok/Instagram/Facebook on your behalf.
- **Billing / subscription paywall** — Paystack is for collecting order
  payments only; the app itself is not metered or gated.
- **Email templates / transactional volume** — email is a single reset-link
  path, not a campaign system.
- **Paystack inline checkout & refunds** — only hosted checkout initialize,
  verify, and webhook settlement are implemented. `PAYSTACK_PUBLIC_KEY` is kept
  for a future inline flow.

---

## 20. Onboarding

**Location:** `src/app/welcome/page.tsx`,
`src/components/custom/onboarding-wizard.tsx`, `src/lib/onboarding.ts`,
`src/app/(dashboard)/dashboard/layout.tsx`.

- **Mandatory first-run setup.** Every new account lands on `/welcome` until the
  shop is complete; the dashboard layout redirects there server-side
  (`getSessionUser` → `getOnboardingStatus`), and `/welcome` bounces finished
  shops to `/dashboard`. Revisiting `/welcome` later edits the same setup.
- **Four steps, each saving through the owner APIs:** store info (name, link
  word, tagline, order phone → `PUT /api/store`), socials (handles + links →
  `PUT /api/store/socials`, WhatsApp prefilled from the order number),
  visuals (logo → `/api/store/logo`, banner → `/api/store/banner`, avatar →
  `/api/profile/image`), review with a live summary.
- **Done means:** store has a name, link word and dialable phone (≥ 9 digits),
  at least one social, and a logo or banner.
