-- Tilo app code.
-- Forward-only. Per-account ownership for every business row, turning the
-- single-tenant deployment into one shop per signed-up account.
--
-- Before this migration the app had NO tenancy boundary: Customer, Order, Store,
-- AutomationRule and Notification were all global, so any signed-in user could
-- read and write every other shop's rows. These `userId` columns are that
-- boundary — API routes now filter on them.
--
-- Safe on an existing database: the columns are added nullable, backfilled to
-- the earliest-created account (the deployment's original owner, who is the only
-- account that could legitimately own pre-existing rows), then tightened to
-- NOT NULL. A database with no users at all stays empty and the NOT NULL
-- constraints apply cleanly to future rows.

-- AlterTable: add the ownership columns (nullable for now, so the backfill below
-- can run before the constraints are tightened).
ALTER TABLE "Customer"      ADD COLUMN "userId" TEXT;
ALTER TABLE "Order"         ADD COLUMN "userId" TEXT;
ALTER TABLE "Store"         ADD COLUMN "userId" TEXT;
ALTER TABLE "AutomationRule" ADD COLUMN "userId" TEXT;
ALTER TABLE "Notification"  ADD COLUMN "userId" TEXT;

-- SmsUsage is different: the ledger is shared, not per-shop. Only sends made on
-- a shop's behalf (automation, manual) carry an owner; sign-up OTPs are sent
-- before an account exists, and the platform summary digests belong to no shop.
ALTER TABLE "SmsUsage"      ADD COLUMN "userId" TEXT;

-- Backfill: everything that already existed belonged to the first account.
DO $$
DECLARE
  owner_id TEXT;
BEGIN
  SELECT "id" INTO owner_id FROM "user" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1;

  IF owner_id IS NOT NULL THEN
    UPDATE "Customer"       SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "Order"          SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "Store"          SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "AutomationRule" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "Notification"   SET "userId" = owner_id WHERE "userId" IS NULL;
    -- Pre-existing ledger rows all came from the single shop this deployment
    -- served, so they belong to that owner too.
    UPDATE "SmsUsage"       SET "userId" = owner_id WHERE "userId" IS NULL;
  END IF;
END $$;

-- Tighten: only possible once every row has an owner. A Store is one-per-user,
-- so a pre-existing duplicate slug/store pair would surface here as a unique
-- violation rather than silently orphaning a storefront.
ALTER TABLE "Customer"       ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Order"          ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Store"          ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "AutomationRule" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Notification"   ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");
CREATE INDEX "Customer_userId_name_idx" ON "Customer"("userId", "name");
CREATE INDEX "Customer_userId_company_idx" ON "Customer"("userId", "company");
CREATE INDEX "Customer_userId_email_idx" ON "Customer"("userId", "email");
CREATE INDEX "Customer_userId_phone_idx" ON "Customer"("userId", "phone");
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");
CREATE INDEX "Order_userId_paidAt_idx" ON "Order"("userId", "paidAt");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX "AutomationRule_userId_idx" ON "AutomationRule"("userId");
CREATE INDEX "AutomationRule_userId_enabled_idx" ON "AutomationRule"("userId", "enabled");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "SmsUsage_userId_createdAt_idx" ON "SmsUsage"("userId", "createdAt");

-- CreateIndex (one storefront per account)
CREATE UNIQUE INDEX "Store_userId_key" ON "Store"("userId");

-- AddForeignKey
ALTER TABLE "Customer"       ADD CONSTRAINT "Customer_userId_fkey"       FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order"          ADD CONSTRAINT "Order_userId_fkey"          FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Store"          ADD CONSTRAINT "Store_userId_fkey"          FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification"   ADD CONSTRAINT "Notification_userId_fkey"   FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
