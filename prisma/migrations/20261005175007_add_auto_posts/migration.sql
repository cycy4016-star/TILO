-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "autoPostDays" INTEGER,
ADD COLUMN     "autoPostLastAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StorePost" ADD COLUMN     "auto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "handle" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialAccount_storeId_idx" ON "SocialAccount"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_storeId_platform_key" ON "SocialAccount"("storeId", "platform");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
