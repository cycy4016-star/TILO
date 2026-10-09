-- AlterTable
ALTER TABLE "ProductCategory" ADD COLUMN     "cover" BYTEA,
ADD COLUMN     "coverMime" TEXT,
ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "itemIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "StoreItem" ADD COLUMN     "stock" INTEGER;
