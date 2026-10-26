CREATE TYPE "UserAudienceKind" AS ENUM ('OWNER', 'COURIER', 'SHOPPER');

CREATE TABLE "user_audience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "UserAudienceKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_audience_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_audience_userId_kind_key" ON "user_audience"("userId", "kind");

CREATE INDEX "user_audience_kind_createdAt_idx" ON "user_audience"("kind", "createdAt");

ALTER TABLE "user_audience" ADD CONSTRAINT "user_audience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "shopperId" TEXT;

CREATE INDEX "Order_shopperId_idx" ON "Order"("shopperId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_shopperId_fkey" FOREIGN KEY ("shopperId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "user_audience" ("id", "userId", "kind", "createdAt")
SELECT 'ua_' || md5(random()::text || clock_timestamp()::text || u."id"), u."id", 'OWNER', CURRENT_TIMESTAMP
FROM "user" u
ON CONFLICT ("userId", "kind") DO NOTHING;
