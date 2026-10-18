-- CreateTable
CREATE TABLE "world_snapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" TEXT NOT NULL,
    "counts" JSONB NOT NULL,
    "bytes" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "world_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "world_snapshot_createdAt_idx" ON "world_snapshot"("createdAt");
