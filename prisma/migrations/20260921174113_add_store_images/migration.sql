-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "logo" BYTEA,
ADD COLUMN     "logoMime" TEXT;

-- AlterTable
ALTER TABLE "StoreItem" ADD COLUMN     "image" BYTEA,
ADD COLUMN     "imageMime" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "inviteCode" TEXT DEFAULT '';
