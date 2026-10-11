-- Hot read paths that had no index.
--
-- Store: the admin overview counts active shops, and slug is already @unique
-- (its implicit index covers the storefront lookup), so the old duplicate
-- @@index([slug]) only cost writes.
CREATE INDEX "Store_active_idx" ON "Store"("active");

-- StoreItem: the storefront reads WHERE storeId + active ORDER BY sortOrder —
-- the composite serves that whole path, and storeId alone is its leftmost
-- prefix so the dashboard's by-store listings still use it. Replaces the bare
-- (storeId) index, which this supersedes.
DROP INDEX "StoreItem_storeId_idx";
CREATE INDEX "StoreItem_storeId_active_sortOrder_idx" ON "StoreItem"("storeId", "active", "sortOrder");

-- Order: admin overview filters on global createdAt ranges; the per-user
-- (userId, createdAt) index cannot serve those.
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- better-auth: Session.userId and Account.userId were unindexed foreign keys,
-- so listing or cascading an account scanned both tables.
CREATE INDEX "Session_userId_idx" ON "session"("userId");
CREATE INDEX "Account_userId_idx" ON "account"("userId");
