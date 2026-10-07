/*
  Warnings:

  - You are about to drop the column `autoPostDays` on the `Store` table. All the data in the column will be lost.
  - You are about to drop the column `autoPostLastAt` on the `Store` table. All the data in the column will be lost.
  - You are about to drop the `AutomationEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AutomationRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StorePost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AutomationEvent" DROP CONSTRAINT "AutomationEvent_customerId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationEvent" DROP CONSTRAINT "AutomationEvent_orderId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationEvent" DROP CONSTRAINT "AutomationEvent_ruleId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationRule" DROP CONSTRAINT "AutomationRule_userId_fkey";

-- DropForeignKey
ALTER TABLE "StorePost" DROP CONSTRAINT "StorePost_itemId_fkey";

-- DropForeignKey
ALTER TABLE "StorePost" DROP CONSTRAINT "StorePost_storeId_fkey";

-- AlterTable
ALTER TABLE "Store" DROP COLUMN "autoPostDays",
DROP COLUMN "autoPostLastAt",
ADD COLUMN     "banner" BYTEA,
ADD COLUMN     "bannerMime" TEXT;

-- DropTable
DROP TABLE "AutomationEvent";

-- DropTable
DROP TABLE "AutomationRule";

-- DropTable
DROP TABLE "StorePost";

-- DropEnum
DROP TYPE "AutomationEventKind";

-- DropEnum
DROP TYPE "AutomationKind";

-- DropEnum
DROP TYPE "SocialPostStatus";
