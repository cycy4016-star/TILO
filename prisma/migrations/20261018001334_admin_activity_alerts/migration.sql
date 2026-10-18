-- CreateEnum
CREATE TYPE "AdminAlertKind" AS ENUM ('SIGNUP', 'STORE', 'ORDER', 'PAYMENT', 'INCIDENT', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "AdminAlertCadence" AS ENUM ('OFF', 'INSTANT', 'HOURLY', 'DAILY');

-- DropIndex
DROP INDEX "Store_slug_idx";

-- CreateTable
CREATE TABLE "AdminAlertSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AdminAlertKind" NOT NULL,
    "cadence" "AdminAlertCadence" NOT NULL DEFAULT 'INSTANT',
    "minAmountPesewas" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAlertSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAlertEvent" (
    "id" TEXT NOT NULL,
    "kind" "AdminAlertKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "amountPesewas" INTEGER,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flushedAt" TIMESTAMP(3),

    CONSTRAINT "AdminAlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AdminAlertKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "amountPesewas" INTEGER,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "digestKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminAlertSetting_userId_kind_key" ON "AdminAlertSetting"("userId", "kind");

-- CreateIndex
CREATE INDEX "AdminAlertEvent_kind_flushedAt_createdAt_idx" ON "AdminAlertEvent"("kind", "flushedAt", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAlertEvent_createdAt_idx" ON "AdminAlertEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAlert_digestKey_key" ON "AdminAlert"("digestKey");

-- CreateIndex
CREATE INDEX "AdminAlert_userId_createdAt_idx" ON "AdminAlert"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAlert_userId_readAt_idx" ON "AdminAlert"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "AdminAlertSetting" ADD CONSTRAINT "AdminAlertSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAlert" ADD CONSTRAINT "AdminAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Account_userId_idx" RENAME TO "account_userId_idx";

-- RenameIndex
ALTER INDEX "Session_userId_idx" RENAME TO "session_userId_idx";
