-- The first audience migration backfilled OWNER for every account, including
-- shoppers. OWNER means "runs a shop": remove it from accounts without a store
-- row, and derive SHOPPER from orders that were actually claimed. Store
-- creation still calls ensureAudience(OWNER), so owners are stamped when the
-- shop opens; claiming an order stamps SHOPPER at claim time.

DELETE FROM "user_audience" ua
USING "user" u
WHERE ua."userId" = u."id"
  AND ua."kind" = 'OWNER'
  AND NOT EXISTS (SELECT 1 FROM "store" s WHERE s."userId" = u."id");

INSERT INTO "user_audience" ("id", "userId", "kind", "createdAt")
SELECT
  'ua_' || md5(random()::text || clock_timestamp()::text || o."shopperId"),
  o."shopperId",
  'SHOPPER',
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "shopperId" FROM "Order" WHERE "shopperId" IS NOT NULL) o
ON CONFLICT ("userId", "kind") DO NOTHING;

INSERT INTO "user_audience" ("id", "userId", "kind", "createdAt")
SELECT
  'ua_' || md5(random()::text || clock_timestamp()::text || s."userId"),
  s."userId",
  'OWNER',
  CURRENT_TIMESTAMP
FROM "store" s
ON CONFLICT ("userId", "kind") DO NOTHING;
