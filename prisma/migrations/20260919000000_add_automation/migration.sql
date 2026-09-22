-- Tilo app code.
-- Forward-only. Adds automation rules + the automation event audit trail.

-- CreateEnum
CREATE TYPE "AutomationKind" AS ENUM ('SMS_NUDGE', 'STATUS_FLIP');

-- CreateEnum
CREATE TYPE "AutomationEventKind" AS ENUM ('SMS_SENT', 'STATUS_FLIPPED', 'SUMMARY_SENT');

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AutomationKind" NOT NULL,
    "triggerStatus" "OrderStatus" NOT NULL,
    "waitHours" INTEGER NOT NULL,
    "message" TEXT,
    "targetStatus" "OrderStatus",
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationEvent" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT,
    "orderId" TEXT,
    "customerId" TEXT,
    "kind" "AutomationEventKind" NOT NULL,
    "to" TEXT,
    "message" TEXT,
    "providerRef" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRule_enabled_kind_idx" ON "AutomationRule"("enabled", "kind");

-- CreateIndex
CREATE INDEX "AutomationRule_enabled_triggerStatus_idx" ON "AutomationRule"("enabled", "triggerStatus");

-- CreateIndex
CREATE INDEX "AutomationEvent_ruleId_orderId_kind_idx" ON "AutomationEvent"("ruleId", "orderId", "kind");

-- CreateIndex
CREATE INDEX "AutomationEvent_kind_createdAt_idx" ON "AutomationEvent"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "AutomationEvent" ADD CONSTRAINT "AutomationEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationEvent" ADD CONSTRAINT "AutomationEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationEvent" ADD CONSTRAINT "AutomationEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;