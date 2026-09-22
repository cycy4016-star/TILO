-- Tilo app code.
-- Forward-only. Adds the social publishing log: every tap of "Share to
-- TikTok / Instagram / Facebook / WhatsApp Status" on a store item is recorded
-- (status SHARED), then moved to PUBLISHED when the owner marks it live.
-- Mirrors prisma/schema/store.prisma: physical table names match model names
-- (@@map is NOT used here).

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('TIKTOK', 'INSTAGRAM', 'FACEBOOK_PAGE', 'WHATSAPP_STATUS');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('SHARED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "StorePost" (
    "id"          TEXT NOT NULL,
    "storeId"     TEXT NOT NULL,
    "itemId"      TEXT NOT NULL,
    "platform"    "SocialPlatform" NOT NULL,
    "status"      "SocialPostStatus" NOT NULL DEFAULT 'SHARED',
    "caption"     TEXT NOT NULL,
    "externalUrl" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorePost_storeId_createdAt_idx" ON "StorePost"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "StorePost_itemId_idx" ON "StorePost"("itemId");

-- AddForeignKey
ALTER TABLE "StorePost" ADD CONSTRAINT "StorePost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePost" ADD CONSTRAINT "StorePost_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StoreItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;