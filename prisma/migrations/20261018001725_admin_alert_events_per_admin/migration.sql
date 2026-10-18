/*
  Warnings:

  - Added the required column `userId` to the `AdminAlertEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AdminAlertEvent_kind_flushedAt_createdAt_idx";

-- AlterTable
ALTER TABLE "AdminAlertEvent" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "AdminAlertEvent_userId_kind_flushedAt_createdAt_idx" ON "AdminAlertEvent"("userId", "kind", "flushedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminAlertEvent" ADD CONSTRAINT "AdminAlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
