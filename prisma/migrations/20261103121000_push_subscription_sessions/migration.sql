-- Bind push endpoints to the login that registered them. Sign-out, session
-- revocation, ban or expiry deletes the session row; the application then
-- removes the matching subscriptions so a logged-out device stops receiving
-- that account's alerts. Nullable for rows created before this migration.
ALTER TABLE "PushSubscription" ADD COLUMN "sessionId" TEXT;
CREATE INDEX "PushSubscription_sessionId_idx" ON "PushSubscription"("sessionId");

ALTER TABLE "CourierPushSubscription" ADD COLUMN "sessionId" TEXT;
CREATE INDEX "CourierPushSubscription_sessionId_idx" ON "CourierPushSubscription"("sessionId");
