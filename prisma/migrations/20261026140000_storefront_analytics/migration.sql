CREATE TYPE "OrderChannel" AS ENUM ('MANUAL', 'STOREFRONT');

ALTER TABLE "Order" ADD COLUMN "channel" "OrderChannel" NOT NULL DEFAULT 'MANUAL';

CREATE INDEX "Order_userId_channel_createdAt_idx" ON "Order"("userId", "channel", "createdAt");

CREATE TABLE "StorefrontView" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "ref" TEXT,
    "referrerHost" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorefrontView_storeId_createdAt_idx" ON "StorefrontView"("storeId", "createdAt");
CREATE INDEX "StorefrontView_storeId_visitorId_createdAt_idx" ON "StorefrontView"("storeId", "visitorId", "createdAt");
CREATE INDEX "StorefrontView_userId_idx" ON "StorefrontView"("userId");

ALTER TABLE "StorefrontView" ADD CONSTRAINT "StorefrontView_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorefrontView" ADD CONSTRAINT "StorefrontView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
