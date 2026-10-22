-- CreateEnum
CREATE TYPE "CourierStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CourierMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DeliveryOfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeliveryEventType" AS ENUM ('INVITED', 'JOINED', 'APPROVED', 'SUSPENDED', 'ONLINE', 'OFFLINE', 'DISPATCHED', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'PICKED_UP', 'DELIVERED', 'HANDOFF_VERIFIED', 'BUYER_CONFIRMED', 'MERCHANT_VERIFIED', 'PROOF_UPLOADED');

-- CreateEnum
CREATE TYPE "DeliveryActorType" AS ENUM ('COURIER', 'MERCHANT', 'BUYER', 'SYSTEM');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "buyerConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "courierId" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryNote" TEXT,
ADD COLUMN     "handoffCode" TEXT,
ADD COLUMN     "handoffCodeUsedAt" TIMESTAMP(3),
ADD COLUMN     "merchantVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "merchantVerifiedBy" TEXT;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "autoDispatch" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dispatchRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL DEFAULT 'MOTORBIKE',
    "plateNumber" TEXT,
    "photo" BYTEA,
    "photoMime" TEXT,
    "status" "CourierStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "CourierSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierCrewInvite" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "uses" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierCrewInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCourier" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "status" "CourierMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreCourier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierLocation" (
    "courierId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierLocation_pkey" PRIMARY KEY ("courierId")
);

-- CreateTable
CREATE TABLE "DeliveryOffer" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "status" "DeliveryOfferStatus" NOT NULL DEFAULT 'OFFERED',
    "distanceKm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "courierId" TEXT,
    "storeId" TEXT,
    "type" "DeliveryEventType" NOT NULL,
    "actorType" "DeliveryActorType" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryProof" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPushSubscription" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Courier_phone_key" ON "Courier"("phone");

-- CreateIndex
CREATE INDEX "Courier_status_idx" ON "Courier"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CourierSession_tokenHash_key" ON "CourierSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CourierSession_courierId_idx" ON "CourierSession"("courierId");

-- CreateIndex
CREATE INDEX "CourierSession_expiresAt_idx" ON "CourierSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourierCrewInvite_tokenHash_key" ON "CourierCrewInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "CourierCrewInvite_storeId_revokedAt_idx" ON "CourierCrewInvite"("storeId", "revokedAt");

-- CreateIndex
CREATE INDEX "CourierCrewInvite_expiresAt_idx" ON "CourierCrewInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "StoreCourier_storeId_status_idx" ON "StoreCourier"("storeId", "status");

-- CreateIndex
CREATE INDEX "StoreCourier_courierId_idx" ON "StoreCourier"("courierId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCourier_storeId_courierId_key" ON "StoreCourier"("storeId", "courierId");

-- CreateIndex
CREATE INDEX "CourierLocation_isOnline_updatedAt_idx" ON "CourierLocation"("isOnline", "updatedAt");

-- CreateIndex
CREATE INDEX "DeliveryOffer_courierId_status_expiresAt_idx" ON "DeliveryOffer"("courierId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "DeliveryOffer_orderId_status_idx" ON "DeliveryOffer"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryOffer_orderId_courierId_key" ON "DeliveryOffer"("orderId", "courierId");

-- CreateIndex
CREATE INDEX "DeliveryEvent_orderId_createdAt_idx" ON "DeliveryEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryEvent_courierId_createdAt_idx" ON "DeliveryEvent"("courierId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryEvent_storeId_createdAt_idx" ON "DeliveryEvent"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryProof_orderId_createdAt_idx" ON "DeliveryProof"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPushSubscription_endpoint_key" ON "OrderPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "OrderPushSubscription_orderId_idx" ON "OrderPushSubscription"("orderId");

-- CreateIndex
CREATE INDEX "Order_courierId_idx" ON "Order"("courierId");

-- AddForeignKey
ALTER TABLE "CourierSession" ADD CONSTRAINT "CourierSession_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierCrewInvite" ADD CONSTRAINT "CourierCrewInvite_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierCrewInvite" ADD CONSTRAINT "CourierCrewInvite_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCourier" ADD CONSTRAINT "StoreCourier_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCourier" ADD CONSTRAINT "StoreCourier_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierLocation" ADD CONSTRAINT "CourierLocation_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPushSubscription" ADD CONSTRAINT "OrderPushSubscription_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
