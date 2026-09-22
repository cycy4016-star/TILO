-- Tilo app code.
-- Forward-only. Turns the narrow nudge/flip engine into the automation
-- platform: new automation kinds, an owner-facing recipient on rules, and
-- payment fields on orders (amount + paidAt) so rules can chase money too.

-- PostgreSQL >= 12 allows ALTER TYPE ... ADD VALUE inside a transaction block
-- as long as the new values are not used in the same transaction — this
-- migration only adds values and columns.

-- CreateEnum (extend)
ALTER TYPE "AutomationKind" ADD VALUE 'READY_PING';
ALTER TYPE "AutomationKind" ADD VALUE 'STALL_ALERT';
ALTER TYPE "AutomationKind" ADD VALUE 'PAYMENT_CONFIRMED';
ALTER TYPE "AutomationKind" ADD VALUE 'PAYMENT_REMINDER';
ALTER TYPE "AutomationKind" ADD VALUE 'REVIEW_REQUEST';
ALTER TYPE "AutomationKind" ADD VALUE 'RE_ENGAGE';

-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN "recipient" TEXT;

-- triggerStatus becomes optional: kinds like PAYMENT_CONFIRMED / RE_ENGAGE are
-- not keyed to a status window and leave it NULL.
ALTER TABLE "AutomationRule" ALTER COLUMN "triggerStatus" DROP NOT NULL;

-- AlterTable (payment chasing support)
ALTER TABLE "Order" ADD COLUMN "amountPesewas" INTEGER;
ALTER TABLE "Order" ADD COLUMN "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_paidAt_idx" ON "Order"("paidAt");