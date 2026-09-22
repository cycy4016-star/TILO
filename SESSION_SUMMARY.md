# Session Summary — Tilo

Date: Mon Sep 21 2026
Scope: Every change made in this session, plus how each was approached.

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