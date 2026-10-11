-- Hot read paths that had no index.
--
-- Store: the admin overview counts active shops, and slug is already @unique
-- (its implicit index covers the storefront lookup), so the old duplicate
-- @@index([slug]) only cost writes.
--
-- Idempotent on purpose: the first deploy of this migration died mid-run
-- (42P01 on a stale `"Session"` identifier, since fixed), leaving partial
-- state, so every statement must be safe to re-apply on heal.
CREATE INDEX IF NOT EXISTS "Store_active_idx" ON "Store"("active");

-- StoreItem: the storefront reads WHERE storeId + active ORDER BY sortOrder —
-- the composite serves that whole path, and storeId alone is its leftmost
-- prefix so the dashboard's by-store listings still use it. Replaces the bare
-- (storeId) index, which this supersedes.
DROP INDEX IF EXISTS "StoreItem_storeId_idx";
CREATE INDEX IF NOT EXISTS "StoreItem_storeId_active_sortOrder_idx" ON "StoreItem"("storeId", "active", "sortOrder");

-- Order: admin overview filters on global createdAt ranges; the per-user
-- (userId, createdAt) index cannot serve those.
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");

-- better-auth: Session.userId and Account.userId were unindexed foreign keys,
-- so listing or cascading an account scanned both tables.
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "session"("userId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "account"("userId");
