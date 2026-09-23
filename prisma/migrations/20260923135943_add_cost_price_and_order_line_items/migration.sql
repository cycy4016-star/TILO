-- AlterTable
ALTER TABLE "StoreItem" ADD COLUMN     "costPricePesewas" INTEGER;

-- CreateTable
CREATE TABLE "OrderLineItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeItemId" TEXT,
    "name" TEXT NOT NULL,
    "unitPricePesewas" INTEGER NOT NULL,
    "unitCostPesewas" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderLineItem_orderId_idx" ON "OrderLineItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderLineItem_storeItemId_idx" ON "OrderLineItem"("storeItemId");

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "StoreItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
