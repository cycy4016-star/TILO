-- Item galleries: multiple ordered photos per product. Existing covers are
-- copied into the new table as position 0 so no photo goes missing.
CREATE TABLE "StoreItemImage" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "image" BYTEA NOT NULL,
    "imageMime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreItemImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreItemImage_itemId_position_idx" ON "StoreItemImage"("itemId", "position");

ALTER TABLE "StoreItemImage" ADD CONSTRAINT "StoreItemImage_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "StoreItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "StoreItemImage" ("id", "itemId", "position", "image", "imageMime", "createdAt", "updatedAt")
SELECT 'img_' || "id", "id", 0, "image", COALESCE("imageMime", 'image/jpeg'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StoreItem"
WHERE "image" IS NOT NULL;
