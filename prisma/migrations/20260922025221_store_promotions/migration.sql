-- CreateEnum
CREATE TYPE "PromotionKind" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "promoBanner" TEXT;

-- AlterTable
ALTER TABLE "StoreItem" ADD COLUMN     "compareAtPricePesewas" INTEGER;

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "kind" "PromotionKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "minSubtotalPesewas" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "image" BYTEA,
    "imageMime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Promotion_storeId_active_idx" ON "Promotion"("storeId", "active");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
