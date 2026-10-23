-- Pending broadcasts created before the dispatch-clock column existed would
-- otherwise never enter the recovery sweep. Give them a fresh clock at deploy;
-- the next sweep widens them and the merchant fallback still fires.
UPDATE "Order"
SET "dispatchStartedAt" = NOW()
WHERE "deliveryStatus" = 'PENDING_DISPATCH'
  AND "dispatchStartedAt" IS NULL;
