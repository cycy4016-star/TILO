-- CreateTable
CREATE TABLE "CourierPushSubscription" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourierPushSubscription_endpoint_key" ON "CourierPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "CourierPushSubscription_courierId_idx" ON "CourierPushSubscription"("courierId");

-- AddForeignKey
ALTER TABLE "CourierPushSubscription" ADD CONSTRAINT "CourierPushSubscription_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
