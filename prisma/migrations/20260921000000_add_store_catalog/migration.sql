-- Tilo app code.
-- Forward-only. Adds the storefront catalog: a Store (one per workspace) and
-- its Product/Service items, whose public page at /store/[slug] lets customers
-- browse and order each item on WhatsApp.

-- CreateEnum
CREATE TYPE "StoreItemKind" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "contactPhone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreItem" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "StoreItemKind" NOT NULL DEFAULT 'PRODUCT',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricePesewas" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE INDEX "Store_slug_idx" ON "Store"("slug");

-- CreateIndex
CREATE INDEX "StoreItem_storeId_idx" ON "StoreItem"("storeId");

-- AddForeignKey
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;