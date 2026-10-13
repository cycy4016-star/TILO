-- CreateEnum
CREATE TYPE "CustomerSource" AS ENUM ('OWNER', 'LEAD', 'ORDER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('BUG', 'COMPLAINT', 'PRAISE', 'SUGGESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'SEEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('ERROR', 'WARN', 'INFO');

-- CreateEnum
CREATE TYPE "AppLogSource" AS ENUM ('SERVER', 'CLIENT');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "inquiryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastInquiryAt" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "source" "CustomerSource" NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "storeId" TEXT,
    "customerId" TEXT,
    "kind" "FeedbackKind" NOT NULL DEFAULT 'OTHER',
    "rating" INTEGER,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "email" TEXT,
    "userAgent" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppLog" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'ERROR',
    "source" "AppLogSource" NOT NULL DEFAULT 'SERVER',
    "message" TEXT NOT NULL,
    "summary" TEXT,
    "route" TEXT,
    "method" TEXT,
    "status" INTEGER,
    "digest" TEXT,
    "stack" TEXT,
    "userId" TEXT,
    "url" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resolvedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_kind_createdAt_idx" ON "Feedback"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "AppLog_lastSeenAt_idx" ON "AppLog"("lastSeenAt");

-- CreateIndex
CREATE INDEX "AppLog_resolvedAt_lastSeenAt_idx" ON "AppLog"("resolvedAt", "lastSeenAt");

-- CreateIndex
CREATE INDEX "AppLog_level_lastSeenAt_idx" ON "AppLog"("level", "lastSeenAt");

-- CreateIndex
CREATE INDEX "AppLog_source_lastSeenAt_idx" ON "AppLog"("source", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppLog_fingerprint_key" ON "AppLog"("fingerprint");

-- CreateIndex
CREATE INDEX "Customer_source_createdAt_idx" ON "Customer"("source", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_userId_source_createdAt_idx" ON "Customer"("userId", "source", "createdAt");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
