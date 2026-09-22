-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SmsSource" AS ENUM ('OTP', 'AUTOMATION', 'SUMMARY', 'MANUAL');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "phoneNumberVerified" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "orderId" TEXT,
    "amountPesewas" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "email" TEXT,
    "authorizationUrl" TEXT,
    "providerRef" TEXT,
    "raw" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsUsage" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "source" "SmsSource" NOT NULL DEFAULT 'MANUAL',
    "body" TEXT,
    "segments" INTEGER NOT NULL DEFAULT 1,
    "credits" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'arkesel',
    "providerRef" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_reference_key" ON "PaymentTransaction"("reference");

-- CreateIndex
CREATE INDEX "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_createdAt_idx" ON "PaymentTransaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SmsUsage_createdAt_idx" ON "SmsUsage"("createdAt");

-- CreateIndex
CREATE INDEX "SmsUsage_source_createdAt_idx" ON "SmsUsage"("source", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_phoneNumber_key" ON "user"("phoneNumber");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
