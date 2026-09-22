-- Tilo app code.
-- Forward-only. Adds the Customer + Order workspace tables missing from the
-- committed history. `20260919000000_add_automation` references these (OrderStatus
-- enum + Customer/Order FKs), so this must apply before it. Mirrors
-- prisma/schema/customer-order-workspace.prisma: physical table names match the
-- model names exactly (@@map is NOT used here).

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Customer" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "company"   TEXT,
    "email"     TEXT,
    "phone"     TEXT,
    "address"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id"          TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId"  TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status"      "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_company_idx" ON "Customer"("company");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;