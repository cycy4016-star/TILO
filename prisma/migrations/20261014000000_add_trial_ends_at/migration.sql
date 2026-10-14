-- Add the free-trial end date to accounts.
--
-- Every new sign-up gets 14 days of the full toolkit; src/lib/auth.ts stamps
-- `trialEndsAt = now() + 14 days` in the user.create.before hook. This
-- migration adds the column and backfills existing accounts from their
-- createdAt so nobody is left without a trial window — pre-existing rows keep
-- the same 14-day length, measured from when they signed up.
--
-- It also flips the persisted theme defaults from the old corporate slate/gold
-- to the bright marketplace orange, matching the new default everywhere else.
--
-- Safe on a fresh database: the UPDATE affects zero rows there.

ALTER TABLE "user" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

UPDATE "user"
SET "trialEndsAt" = "createdAt" + INTERVAL '14 days'
WHERE "trialEndsAt" IS NULL;

ALTER TABLE "Store" ALTER COLUMN "theme" SET DEFAULT 'orange';

ALTER TABLE "AppearancePreference" ALTER COLUMN "theme" SET DEFAULT 'orange';
