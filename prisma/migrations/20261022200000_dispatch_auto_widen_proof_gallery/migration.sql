-- Auto-widen dispatch state, admin proof moderation, and multi-order buyer push.

-- AlterEnum
ALTER TYPE "DeliveryEventType" ADD VALUE 'DISPATCH_WIDENED';
ALTER TYPE "DeliveryEventType" ADD VALUE 'DISPATCH_FALLBACK';
ALTER TYPE "NotificationKind" ADD VALUE 'DELIVERY_ATTENTION';

-- CreateEnum
CREATE TYPE "ProofReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "dispatchStartedAt" TIMESTAMP(3),
ADD COLUMN "dispatchRadiusKm" DOUBLE PRECISION,
ADD COLUMN "dispatchWidenedAt" TIMESTAMP(3),
ADD COLUMN "dispatchFallbackAt" TIMESTAMP(3);

-- DropIndex
DROP INDEX "Order_deliveryStatus_idx";

-- CreateIndex
CREATE INDEX "Order_deliveryStatus_dispatchStartedAt_idx" ON "Order"("deliveryStatus", "dispatchStartedAt");

-- AlterTable
ALTER TABLE "DeliveryProof" ADD COLUMN "reviewStatus" "ProofReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedBy" TEXT,
ADD COLUMN "reviewNote" TEXT;

-- CreateIndex
CREATE INDEX "DeliveryProof_marketingConsent_reviewStatus_createdAt_idx" ON "DeliveryProof"("marketingConsent", "reviewStatus", "createdAt");

-- DropIndex
DROP INDEX "OrderPushSubscription_endpoint_key";

-- CreateIndex
CREATE UNIQUE INDEX "OrderPushSubscription_orderId_endpoint_key" ON "OrderPushSubscription"("orderId", "endpoint");

-- CreateIndex
CREATE INDEX "OrderPushSubscription_endpoint_idx" ON "OrderPushSubscription"("endpoint");
