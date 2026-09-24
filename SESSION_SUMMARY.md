# Session Summary — Tilo

Date: Mon Sep 21 2026 (initial) → Thu Sep 24 2026 (latest)
Scope: Every change made across the documented sessions, plus how each was
approached. Section 1–6 cover the Sep 21 session; section 7 onward covers the
Sep 22–24 sessions (privacy/terms, dashboards, ownership, and the SMS-OTP
sign-up rework).

---

## 1. Objective

Two requested features, on top of the already deploy-ready Tilo app targeting Render:

1. **Invite-code-gated sign-up** — only people with a shared code may create an account (unless they signed in via Google / already email-verified, who are exempt).
2. **Store images + avatars** — capture or upload a logo for the store, photos for items, and a profile avatar; store them persistently and serve them publicly.

A third, incidental fix: the local dev server was running a **stale Prisma client**, which made the store manager "not open / Shutters stuck". Diagnostics and a restart resolved it.

---

## 2. How I went about it (approach)

### General method used throughout
- **Explored first, wrote second.** Read the relevant files (`src/lib/env.ts`, the auth files, `prisma/schema`, contracts, `api-client.ts`) before editing, so new code followed existing conventions exactly (types, error handling, route structure, cache headers).
- **Contracts-first.** Added the DB columns, then updated the shared TS contracts (`StoreItemRecord.hasImage`, `StorePayload.hasLogo`, `StorePublic.logoUrl`, item `imageUrl`, `ProfileImageResult`), then fixed every call-site until the typecheck passed.
- **Every change gated.** After finishing, I ran the full verification ladder — no code was left green-unverified:

```
npm run typecheck         -> types clean (0 errors)
npx biome check .         -> lint clean (0 errors / warnings)
npm test                  -> 145/145 unit tests pass
npm run build             -> next build succeeds, every new route listed
npx prisma migrate status -> up to date
```

### Why each piece was built the way it was

- **Images in Postgres (bytea), not files/S3.** Render's filesystem is ephemeral; DB-backed bytes survive redeploys and need no external object storage. Client-side canvas compression keeps payloads small (~1280px JPEG q0.82 for items, 512px q0.85 for avatars); server caps 5MB items / 2MB logo+avatar and allowlists `jpeg/png/webp/gif`.
- **Public routes read bytes directly** (`/api/public/store/[slug]/logo`, `/api/public/store/items/[itemId]/image`) with `cache-control: public, max-age=86400` and `404` when nothing is stored (logo also requires the store to be `active`). The store *manager* PUTs/DELETEs images under authed routes; the profile avatar route stores a data URL on `User.image`.
- **A separate `src/lib/uploads.ts` (raw `fetch` + FormData).** The app's `apiFetch` always forces `content-type: application/json`, so multipart uploads needed their own helper — this is why avatars/uploads couldn't just "go through the api client".
- **Shared serializers.** Store shapes are produced in a few places; I centralised `serializeStoreItem` / `serializeStore` in `src/lib/store-serializers.ts` so `hasImage` / `hasLogo` / URLs are computed in exactly one spot (this also fixed a latent duplicate-`serializeStore` conflict while refactoring).
- **Invite gate is server-enforced, client-optional.** The code lives in `databaseHooks.user.create.before` in `src/lib/auth.ts`: if `SIGNUP_INVITE_CODE` is set and the new user is neither email-verified (Google) nor submitting the matching code, the hook returns `false` and sign-up is aborted. The form only shows the invite field when `NEXT_PUBLIC_SIGNUP_INVITE === 'true'`. Setting the env = gate ON; unset = sign-up open.

### Windows/hand-off notes that guided decisions
- Prisma CLI ignores `.env.local`, so I passed `DATABASE_URL` inline for `prisma migrate`/`generate`.
- `prisma generate` emits a harmless EPERM (DLL rename) while a dev server is running — types still update, the *server* just needs a restart to pick them up.

---

## 3. What was changed

### Workstream A — Invite-code gating
- `prisma/schema/auth.prisma`: added `User.inviteCode` (string, nullable).
- `src/lib/env.ts`: added `SIGNUP_INVITE_CODE` (server) and `NEXT_PUBLIC_SIGNUP_INVITE` (client, default `'false'`).
- `src/lib/auth-config.ts`: `user.additionalFields` now includes `inviteCode`.
- `src/lib/auth.ts`: `create.before` hook enforces the gate (rejects phone-first sign-ups with blank/mismatched code; Google/email-verified exempt).
- `src/lib/auth-client.ts`: added `inferAdditionalFields` plugin.
- `src/components/custom/sign-up-form.tsx`: conditional invite field, submits `inviteCode: inviteCode.trim()`.
- Docs: `.env.example`, `README.md`, `FEATURES.md`.

### Workstream B — Store images + avatars
- Migration `20260921174113_add_store_images` (applied, up to date):
  - `Store.logo`, `Store.logoMime` (Bytes)
  - `StoreItem.image`, `StoreItem.imageMime` (Bytes)
  - plus `User.inviteCode` above.
- Server `src/lib/image-upload.ts`: `readImageUpload()` — MIME + size validation, returns the bytes.
- Public routes:
  - `/api/public/store/[slug]/logo` (GET, requires active store, 404 if none)
  - `/api/public/store/items/[itemId]/image` (GET, 404 if none)
  - both send `cache-control: public, max-age=86400`.
- Authed routes: `PUT`/`DELETE` for `/api/store/items/[itemId]/image`, `/api/store/logo`, and `/api/profile/image` (avatar → data URL on `User.image`).
- Client helpers/files:
  - `src/lib/image.ts`: `compressImageFile` + preview helpers.
  - `src/lib/uploads.ts`: `uploadImageFile` (raw `fetch` + FormData).
  - `src/components/custom/image-picker.tsx`: `ImagePicker` + `ImageSelection` (camera/gallery/preview/clear, square + circle shapes).
- Contracts/serializers:
  - `src/lib/store-serializers.ts`: shared `serializeStoreItem` / `serializeStore`.
  - `src/lib/contracts/store.ts`: `hasImage`, `hasLogo`, `logoUrl`, item `imageUrl`.
  - `src/lib/contracts/account.ts`: `ProfileImageResult`.
- UI wiring:
  - `src/components/custom/store-workspace.tsx`: item photo + store logo pickers (compress → upload after save; DELETE to clear; thumbnails on the shelf).
  - `src/app/store/[slug]/page.tsx`: hero logo + item photos.
  - `src/app/(auth)/profile/page.tsx`: avatar card with `ImagePicker` and `useSession().refetch()` after upload.
- `biome.json`: switched off `performance.noImgElement` for the files that legitimately use `<img>` (image-picker, store-workspace, profile page, store pages). Note: used `src/app/store/*/page.tsx` because brackets (`[slug]`) break biome's glob parser. Removed the inline eslint-disable comments.
- Tests: `tests/unit/store.test.ts` fixtures updated with `hasLogo`/`hasImage`/`logoUrl`/`imageUrl`.

### Fix — "Shutters stuck" / store not loading
- **Symptom:** store manager showed "Shutters stuck", store would not load.
- **Diagnosis (evidence-based):** the running dev server (PID 21868, booted 9/20) still held the *old* Prisma client — `.next/dev/logs/next-development.log` showed:

```
Unknown field `image` for select statement on model StoreItem
```

  so every `GET /api/store` threw internally (500) and the UI rendered the offline banner.
- **Why:** the dev server loaded the Prisma client before the migration + `prisma generate`; Turbopack kept serving the stale in-memory DMMF. Source was already correct — the migration applied, `next build` passed, and a fresh node probe hit the new columns fine.
- **Fix:** killed the stale server tree (`taskkill /PID 21868 /T /F`) and started a fresh `npm run dev`.
- **Verification after restart:**
  - `/api/auth/get-session` → 200
  - `GET /api/store` → 403 (auth check, no crash)
  - `/api/public/store/items/nope/image` → **404** (was 500)
  - `/api/public/store/nosuch/logo` → **404** (was 500)
- Expected browser behaviour now: signed-in session with no store shows the "create store" empty state; the manager loads instead of "Shutters stuck".

---

## 4. Gate results (all green)

| Check | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npx biome check .` | 0 errors / warnings |
| `npm test` | 145/145 pass |
| `npm run build` | success, all new routes listed |
| `npx prisma migrate status` | up to date |

---

## 5. Known notes / follow-ups (not blockers)

- **Local dev server was restarted** to load the new Prisma client — this is normal after `prisma generate`.
- `.env.local` holds live test secrets — **rotate before public use**. Ensure `DATABASE_URL` points at the real Postgres for Render.
- On Render: run `prisma migrate deploy` on deploy, then set `SIGNUP_INVITE_CODE` and `NEXT_PUBLIC_SIGNUP_INVITE=true` to activate the gate. Images need no extra config (Postgres bytea).
- Important typo in this file header aside — nothing else outstanding. If the app still misbehaves in the browser, hard-refresh (Ctrl+Shift+R) to clear any stale client bundle.

---

## 6. Key files, quick reference

| Concern | Files |
|---|---|
| Store serialization | `src/app/api/store/route.ts`, `src/lib/store-serializers.ts`, `src/lib/contracts/store.ts` |
| Image pipeline (client) | `src/lib/image.ts`, `src/lib/uploads.ts`, `src/components/custom/image-picker.tsx` |
| Image serve/upload (server) | `src/lib/image-upload.ts`, `src/app/api/public/store/items/[itemId]/image/route.ts`, `src/app/api/public/store/[slug]/logo/route.ts`, `src/app/api/store/items/[itemId]/image/route.ts`, `src/app/api/store/logo/route.ts`, `src/app/api/profile/image/route.ts` |
| Invite gate | `src/lib/auth.ts`, `src/lib/auth-config.ts`, `src/lib/auth-client.ts`, `src/components/custom/sign-up-form.tsx`, `src/lib/env.ts` |
| Schema/migrations | `prisma/schema/store.prisma`, `prisma/schema/auth.prisma`, `prisma/migrations/20260921174113_add_store_images` |
| UI surfaces | `src/components/custom/store-workspace.tsx`, `src/app/store/[slug]/page.tsx`, `src/app/(auth)/profile/page.tsx` |
| Config/docs | `.env.example`, `README.md`, `FEATURES.md`, `biome.json` |
| Tests | `tests/unit/store.test.ts` |

---

## 7. Sep 22 session — legal pages, deploy docs

### What
- Added `/privacy` and `/terms` static pages plus a shared `LegalPage` shell, linked from the storefront footer. `LeadCaptureCard` gained a consent line pointing at the privacy page.
- Documented the Neon connection string and the Render free-Postgres expiry in `render.yaml` / `.env.example`, and fixed `SKIP_ENV_VALIDATION` so env validation actually runs on Render.
- First commit (`f98caaa`, v0.1.0) landed the whole workspace; the two pages and deploy tweaks were separate commits.

### How
- `src/app/(custom)/privacy/page.tsx`, `terms/page.tsx`, `src/components/custom/legal-page.tsx`, `src/lib/legal.ts`, `src/lib/nav.ts`, `render.yaml`.

---

## 8. Sep 23 (morning) — ownership + dashboards

### What
- **Every signed-in user is an owner.** Removed the crew/user tier and the admin gate: all sessions get `role: admin` at creation (see `user.create.before` in `src/lib/auth.ts`), and "is admin" collapsed to "is signed in". Navigation, shell, and guards (`require-admin`, `require-admin-api`) were simplified accordingly.
- **Automations opened to all users** — no admin route gate; the workspace now directs every signed-in account.
- **Cost/profit + products + intelligence dashboards.** Added order line items and item cost price (migrations `add_cost_price_and_order_line_items`), new dashboard pages (admin users, intelligence, products) and APIs built from the order/usage data the workspace already collects.

### How
- `require-admin`, `require-admin-api`, `auth-client.useIsAdmin`, `dashboard-shell/nav`, `admin-monitor`, `automations-workspace`, plus the contracts `admin.ts`, `intelligence.ts`, `products.ts`, `order.ts` extensions. `src/app/api/dashboard/*` and `src/app/api/admin/users/route.ts` power the views; `src/app/(dashboard)/dashboard/{admin,intelligence,products}/page.tsx` render them.

---

## 9. Sep 23 (evening) — BMS SMS + OTP enforcement

### What
- **Switched the SMS provider to BMS Africa (mNotify)** as the approved Ghana provider, with Arkesel left as an alternative behind `SMS_PROVIDER`. `smsProviderName()` helper added; `render.yaml` defaults to `bms` and syncs `BMS_API_KEY` / `BMS_SENDER_ID` as secrets.
- **Enforced phone verification by SMS.** `requireVerification: true` on the `phoneNumber` plugin; `user.create.before` no longer auto-trusts the submitted number (`phoneNumberVerified: false` unless already proven). Sign-up gained an inline 6-digit OTP step (`sendOtp` → `phoneNumber.verify`). Sign-in checks `phoneNumberVerified` and routes unverified accounts to `/verify` instead of the dashboard. `/verify` is the rescue ramp.

### How
- `src/lib/auth.ts` (create-hook + plugin flags), `src/lib/sms.ts` (`sendViaBms`, provider switch), `src/lib/require-auth.ts`, `src/components/custom/sign-up-form.tsx`, `sign-in-form.tsx`, `verify-form.tsx`, `src/lib/env.ts`, `render.yaml`.

---

## 10. Sep 24 session — verify-before-create sign-up (this revision)

### Problem
The Sep 23 flow still created the user *before* the OTP was proven (`signUp.email` at button press, then `verify` on the code step). A bad/missed code left a real, unverified account that had to be cleaned up by the `/verify` ramp, and a taken phone number was only detected after an SMS was already spent.

### What
Restructured phone-first sign-up so **no user row exists until the SMS code is verified**:

- **Custom better-auth plugin `phoneVerifiedSignUp`** (`src/lib/auth.ts`) hosting two endpoints under `/phone-number/*` (so they inherit the phone plugin's 10/min/IP rate limit):
  - **`POST /phone-number/sign-up`** — runs every pre-check *first* (E.164 format, password policy via `ctx.context.password.config`, email synthesis `` `${phone}@phone.tilo` `` when omitted, email + phone uniqueness, invite-code gate), then replicates the phone plugin's `verifyPhoneNumberOTP` exactly (recreate-on-wrong-code with `code:attempts` value, 3-attempt cap, expire delete), and **only then** `createUser` (app hooks still run: admin role, `phoneNumberVerified: true`, invite gate) → `linkAccount` (credential + hashed password, with orphan-user cleanup on failure) → `createSession` → login cookie → `{ token, user }`. Mirrors the internal `signUpEmail` but skips its transaction wrapper.
  - **`POST /phone-number/check-availability`** — cheap `{ available, reason: 'phone'|'email' }` probe the form calls *before* sending an SMS, so a taken number/email never wastes a send.
- **Disabled the built-in email sign-up:** `emailAndPassword.disableSignUp: true` in `auth-config.ts` (comment explains why), so nothing can create an unverified account behind the form's back.
- **Form rework** (`sign-up-form.tsx`): details step validates → `$fetch('/phone-number/check-availability')` → blocks with "already in use. Sign in instead." if unavailable → only then `sendOtp`. Code step does a single `$fetch('/phone-number/sign-up', …)` which proves the code **and** creates the account; removes the old `signUp` import and the create-then-verify hack. `verify-form`/`sign-in-form` unchanged (legacy/Google paths still use `phoneNumber.verify` + `signIn`).
- **BMS `sms_type` routing fix:** added `BMS_SMS_TYPE` (`otp` default | `bulk`) to `env.ts`/`sms.ts`. The `otp` transactional route bills the *paid wallet*; **free/bonus credits only flow on the bulk route**. A live test hit `402 insufficient wallet balance` on `otp` and succeeded (credit 58→57→56, providerRef `E1DA8045-…`, ledger `ok: true`) on `bulk`. `.env.local` now sets `BMS_SMS_TYPE=bulk` for the free-credit account; also fixed the non-2xx error to read mNotify's `error` field (was blank `BMS 402: `). Docs updated in `.env.example`, `README.md`, `FEATURES.md`.

### How
Verified prerequisites against the installed better-auth `dist` before writing code: rate-limiter keys `ip + path`; `verifyPhoneNumberOTP` consume-once semantics; `internalAdapter` methods and `createWithHooks` behaviour; public export surfaces (`better-auth/api` → `createAuthEndpoint`/`formCsrfMiddleware`, `better-auth/cookies` → `setSessionCookie`, `better-auth/db` → `parseUserOutput`); the app's zod 3.25.76 exposes Standard-Schema v1 so endpoint `body` validation works. Endpoint keys (`signUpPhone`, `checkPhoneAvailability`) and paths (`/phone-number/sign-up`) verified conflict-free, and `getEndpoints` merges `...plugin.endpoints`.

### Gate results (Sep 24)

| Check | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint` (biome) | clean, 218 files |
| `npm test` | 145/145 pass |
| Live `next dev` probes | `/phone-number/check-availability` → 400 `INVALID_PHONE_NUMBER` (bad), `{available:true}` (fresh); `/phone-number/sign-up` → 400 `OTP_NOT_FOUND`; `/phone-number/send-otp` → 200 `code sent` |
| BMS live send | free credit consumed (58→56 over two tests), ledger `ok: true`, real campaign ref returned; wallet-balance account would need `BMS_SMS_TYPE=otp` |
| Push | `200d6c4..d31bfe9 main -> main` |

### Known notes
- `.env.local` holds live test secrets (BMS key, DB URL) — rotate before public use; it is git-ignored and never committed.
- Free-credit BMS accounts must keep `BMS_SMS_TYPE=bulk` in `.env.local`; paid-wallet accounts can leave the default `otp`.
- Rate limiting on the new endpoints: 10/min/IP per path (inherited from the phone plugin). Wrong codes consume the 3-attempt budget then hard-delete the OTP record.