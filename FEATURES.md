# Tilo — Feature Inventory

Tilo is a WhatsApp-led business operations workspace for small Ghanaian/African
businesses. It turns conversations, notebooks, and spreadsheets into one
operating system: customers, linked orders, money chasing, an SMS automation
engine, a catalogue/storefront, and social sharing — behind one authenticated
dashboard.

This document lists **everything the app does today**, what each piece is for,
where it lives, and what is deliberately not built yet.

---

## 1. Tenancy & deployment model

- **One workspace per deployment (single-tenant).** There is no
  `Workspace`/`Organization` model. Every signed-in user sees the same customer,
  order, store, and automation data. To serve another business, deploy another
  instance with its own database and env.
- The app is designed to run on Vercel or Render with a managed PostgreSQL
  database. `render.yaml` provisions both automatically.
- Seeding is idempotent and runs at boot (`src/lib/seed.ts`); it is an
  intentional no-op today, so a fresh database boots clean and empty.

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
- **Admin role.** The better-auth `admin` plugin is enabled. The owner is
  promoted **on phone verification** when their verified phone matches
  `ADMIN_PHONE`, or their email matches `ADMIN_EMAIL`
  (`auth.ts → grantAdminIfOwner`, also via `callbackOnVerification`). This fixes
  the previous gap where admin required a *verified email* that nothing ever
  verified.
- **Server gates:** `requireAuth()` (any signed-in user) and `requireAdmin()`
  (admin-only) both throw a 401 `Response`. Client-side gating uses
  `useSession()` / `useIsAdmin()`.
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
- **SMS this month card** (`/api/dashboard/sms-usage`,
  `src/components/custom/dashboard/sms-usage-card.tsx`): messages sent and
  failed this month, credits burned, estimated spend in GHS, breakdown by source
  (sign-in codes / automations / briefs / manual), and lifetime totals.
- **Navigation shell**: links to Dashboard, Customers, Store, Automations.

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

## 7. Automations engine

**Location:** `src/lib/automation.ts`, `src/lib/contracts/automation.ts`,
`src/app/(dashboard)/dashboard/automations/**`,
`src/components/custom/automations-workspace.tsx`,
`src/app/api/automation/**`, `src/app/api/cron/**`.

- **Rule builder** with 8 kinds, each with a plain-language blurb, suggested
  trigger status, and required fields:
  | Kind | What it does |
  | --- | --- |
  | `SMS_NUDGE` | Text the customer a nudge when an order sits too long. |
  | `STATUS_FLIP` | Move an order to the next status automatically. |
  | `READY_PING` | Text the customer when an order is done. |
  | `STALL_ALERT` | Text the owner when an order has been stuck too long. |
  | `PAYMENT_CONFIRMED` | Text a receipt when an order is marked paid. |
  | `PAYMENT_REMINDER` | Chase an unpaid order that has an amount. |
  | `REVIEW_REQUEST` | Ask for a review after delivery. |
  | `RE_ENGAGE` | Win back customers with no order in weeks. |
- Per-rule: name, trigger status, wait time (hours), message template, recipient,
  target status, enabled toggle. Cross-field validation picks the right fields
  per kind.
- **Sweep** (`POST /api/cron/rules`): finds due rules, applies them, records
  `AutomationEvent` rows (`SMS_SENT`, `STATUS_FLIPPED`, `SUMMARY_SENT`), and
  de-duplicates so the same action isn't sent twice.
- **Daily brief** (`POST /api/cron/daily-brief`) and **weekly summary**
  (`POST /api/cron/weekly-summary`) text the owner a one-message pulse.
- Cron routes are guarded by `Authorization: Bearer <CRON_SECRET>`; without the
  secret they return 401.
- Event feed UI (`/api/automation/events`) shows recent automation activity and
  success/failure.

---

## 8. SMS (Arkesel)

**Location:** `src/lib/sms.ts`, `src/lib/env.ts`,
`prisma/schema/sms.prisma`, `src/app/api/dashboard/sms-usage/route.ts`.

- **Provider:** Arkesel (`SMS_PROVIDER=arkesel`), one JSON endpoint, Ghanaian
  sender IDs. `sendSms(to, message, source)` never throws and returns
  `{ ok, providerRef, error }`.
- **Sources** recorded on every send: `OTP`, `AUTOMATION`, `SUMMARY`, `MANUAL`.
- **Usage ledger.** Every attempt (success or failure) is written to the
  `SmsUsage` table with segment count, credits, provider reference, and error.
  This powers the dashboard card and gives per-feature cost visibility.
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
`src/lib/contracts/store.ts`.

- Manage a store: name, slug (URL-safe), tagline, description, contact phone,
  active toggle, and a **logo** (capture or upload).
- Catalogue **items** as `PRODUCT` or `SERVICE`, each with name, description,
  price (pesewas), sort order, active flag, and a **photo** (capture or upload).
- **Images live in Postgres** (`Store.logo`/`StoreItem.image` bytea columns) and
  are served read-only by public routes — no object storage, so they survive
  Render's ephemeral disk and deploy with no extra setup. Photos are compressed
  client-side (canvas, ~1280px JPEG) before upload and capped server-side (item
  5 MB, logo/avatar 2 MB).
- **Public storefront** at `/store/<slug>` served by
  `/api/public/store/<slug>`: live items only, no internal IDs. Draft/inactive
  items are hidden. The hero shows the logo and shelf cards show item photos.
- Store dashboard (`store-workspace.tsx`) shows photo thumbnails on shelf cards
  and supports replace/remove for both logo and item photos in their forms.

---

## 11. Social publishing queue

**Location:** `src/app/api/store/posts/**`, `src/lib/contracts/social.ts`,
`src/components/custom/store-workspace.tsx`.

- Press "Share to {platform}" on a catalogue item to queue a post with a caption.
- Platforms: `TIKTOK`, `INSTAGRAM`, `FACEBOOK_PAGE`, `WHATSAPP_STATUS`.
- Status: `SHARED → PUBLISHED`; a published push can store the external post URL.
- This is a **tracking queue** (caption + link), not a platform API integration.

---

## 12. API surface

All routes own their data; client pages call them through `apiFetch` with a
shared Zod contract (`src/lib/contracts/`). No Server Actions.

| Method(s) | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `*` | `/api/auth/[...all]` | public | better-auth (sign-up, sign-in, OTP, reset) |
| `GET/POST` | `/api/customers` | user | list/search, create |
| `GET` | `/api/customers/[customerId]` | user | read (with orders) |
| `GET/POST` | `/api/orders` | user | list (customer/status/free-text search), create |
| `PATCH` | `/api/orders/[orderId]` | user | update status/amount/paidAt |
| `GET/POST` | `/api/automation/rules` | user | list, create rules |
| `PATCH/DELETE` | `/api/automation/rules/[ruleId]` | user | update, delete rules |
| `GET` | `/api/automation/events` | user | recent automation activity |
| `POST` | `/api/automation/sweep` | user | manually run the sweep |
| `GET` | `/api/dashboard/overview` | user | money/order metrics |
| `GET` | `/api/dashboard/sms-usage` | user | SMS usage + cost |
| `GET` | `/api/notifications` | user | live activity feed + unread count |
| `POST` | `/api/notifications/read` | user | mark all notifications read |
| `POST` | `/api/sms/send` | user | send a manual TILO SMS to a customer |
| `GET/PUT` | `/api/store` | user | read/upsert the store |
| `GET/POST` | `/api/store/items` | user | list/create catalogue items |
| `PATCH/DELETE` | `/api/store/items/[itemId]` | user | update/delete item |
| `PUT/DELETE` | `/api/store/items/[itemId]/image` | user | attach/remove item photo |
| `GET/POST` | `/api/store/promotions` | user | list/create promotions |
| `PATCH/DELETE` | `/api/store/promotions/[promoId]` | user | update/delete promotion |
| `PUT/DELETE` | `/api/store/promotions/[promoId]/image` | user | attach/remove promo photo |
| `PUT/DELETE` | `/api/store/logo` | user | attach/remove store logo |
| `PUT/DELETE` | `/api/profile/image` | user | set/clear profile avatar |
| `GET/POST` | `/api/store/posts` | user | social queue list/create |
| `PATCH/DELETE` | `/api/store/posts/[postId]` | user | update/delete queued post |
| `GET` | `/api/public/store/[slug]` | public | public storefront |
| `POST` | `/api/public/store/[slug]/orders` | public + rate-limit | storefront order placement (auto-adds customer) |
| `POST` | `/api/public/store/[slug]/leads` | public + rate-limit | visitor capture with consent |
| `GET` | `/api/public/store/items/[itemId]/image` | public | item photo bytes |
| `GET` | `/api/public/store/promotions/[promoId]/image` | public | promotion photo bytes |
| `GET` | `/api/public/store/[slug]/logo` | public | store logo bytes |
| `POST` | `/api/payments/initialize` | user | start Paystack checkout |
| `GET` | `/api/payments/verify` | user | verify + settle a transaction |
| `POST` | `/api/payments/webhook` | signature | Paystack webhook (source of truth) |
| `GET`/`POST` | `/api/cron/rules` | cron secret | list events / run sweep |
| `POST` | `/api/cron/daily-brief` | cron secret | morning pulse SMS |
| `POST` | `/api/cron/weekly-summary` | cron secret | weekly pulse SMS |

---

## 13. Data model

**Location:** `prisma/schema/*.prisma`.

- **Auth:** `User` (with `phoneNumber` unique + `phoneNumberVerified`, `role`,
  `inviteCode`), `Session`, `Account`, `Verification`.
- **Workspace:** `Customer`, `Order` (`amountPesewas`, `paidAt`, `OrderStatus`),
  `AutomationRule`, `AutomationEvent`.
- **SMS:** `SmsUsage` (`source`, `to`, `message`, `segments`, `credits`, `ok`,
  `providerRef`, `error`, `createdAt`).
- **Payments:** `PaymentTransaction` (`reference` unique, `orderId`, amount,
  currency, status, email, authorizationUrl, providerRef, raw).
- **Store:** `Store` (with `logo`/`logoMime` bytea), `StoreItem`
  (`PRODUCT`/`SERVICE`, price, sortOrder, active, `image`/`imageMime` bytea),
  `SocialPost` (platform, caption, status, externalUrl).

Migrations live in `prisma/migrations/` and are applied with
`prisma migrate deploy`.

---

## 14. Security

- Per-request CSP nonce + security headers (`proxy.ts`, `src/lib/csp.ts`,
  `next.config.ts`).
- Every data route is gated by `requireAuth`/`requireAdmin` (401 otherwise).
- The Paystack webhook is authenticated by HMAC-SHA512 signature over the raw
  body, compared in constant time.
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
- **Automation + SMS:** `CRON_SECRET`, `SMS_PROVIDER`, `ARKESEL_API_KEY`,
  `ARKESEL_SENDER_ID`, `SMS_SUMMARY_RECIPIENT`, `SMS_COST_PER_CREDIT_PESEWAS`.
- **Email (optional):** `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`.
- **Paystack (optional):** `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`,
  `PAYSTACK_CALLBACK_URL`.
- **Google OAuth (optional):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
  client-side `NEXT_PUBLIC_GOOGLE_AUTH=true`.

You can verify an Arkesel key + sender ID without any UI by running the app with
`SMS_PROVIDER=arkesel` and invoking a send (e.g. the automation sweep), then
checking the `SmsUsage` rows.

---

## 17. Operations

- **Local:** `npm install`, `npm run db:migrate:dev`, `npm run dev`.
- **Checks:** `npm run typecheck`, `npm run lint`, `npm run test`.
- **DB:** `db:generate`, `db:migrate:dev`, `db:migrate:deploy`, `db:studio`.
- **Deploy:** Vercel (`vercel-build` runs `prisma generate && prisma migrate
  deploy && next build`) or Render (`render.yaml`).
- **Schedulers:** trigger the three `/api/cron/*` routes from cron-job.org or
  GitHub Actions with the `CRON_SECRET` bearer header.

---

## 18. Testing

- Vitest unit/integration suite (145 tests): contracts, route handlers,
  permissions policy, CSP, nav, store, promotions, live-orders (public order
  placement, lead capture, notifications, SMS dispatch), sms templates,
  instrumentation, SEO text.
- Postgres integration tests via `npm run test:postgres` (needs
  `TEST_DATABASE_URL`).

---

## 19. Deliberately not built (yet)

- **Multi-tenant workspaces** — one workspace per deployment by design.
- **WhatsApp Business API** — contact links use `wa.me`; no Cloud API sending.
- **Live social publishing** — the social queue tracks captions/links; it does
  not call TikTok/Instagram/Facebook APIs.
- **Billing / subscription paywall** — Paystack is for collecting order
  payments only; the app itself is not metered or gated.
- **Email templates / transactional volume** — email is a single reset-link
  path, not a campaign system.
- **Paystack inline checkout & refunds** — only hosted checkout initialize,
  verify, and webhook settlement are implemented. `PAYSTACK_PUBLIC_KEY` is kept
  for a future inline flow.
