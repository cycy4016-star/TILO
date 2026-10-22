-- Keep the raw invite token so a merchant can copy the active crew link again.
-- This token only lets a rider apply; approval remains a separate merchant step.
ALTER TABLE "CourierCrewInvite" ADD COLUMN "token" TEXT;

CREATE UNIQUE INDEX "CourierCrewInvite_token_key" ON "CourierCrewInvite"("token");
