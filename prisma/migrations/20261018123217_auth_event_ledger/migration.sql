-- CreateEnum
CREATE TYPE "AuthEventKind" AS ENUM ('SIGNUP', 'SIGNIN');

-- CreateTable
CREATE TABLE "auth_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AuthEventKind" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_event_userId_createdAt_idx" ON "auth_event"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "auth_event_kind_createdAt_idx" ON "auth_event"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "auth_event" ADD CONSTRAINT "auth_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing account contributed a SIGNUP at creation time.
-- gen_random_uuid() stands in for the app-side cuid() default (ids only need to
-- be unique; the app never parses them).
INSERT INTO "auth_event" ("id", "userId", "kind", "createdAt")
SELECT gen_random_uuid()::text, "id", 'SIGNUP', "createdAt"
FROM "user";

-- Backfill: sessions that still exist represent real sign-ins that were never
-- captured by the ledger. (Sign-ins whose session rows were already deleted by
-- sign-out/expiry are unrecoverable — the ledger is accurate from now on.)
INSERT INTO "auth_event" ("id", "userId", "kind", "ipAddress", "userAgent", "createdAt")
SELECT gen_random_uuid()::text, "userId", 'SIGNIN', "ipAddress", "userAgent", "createdAt"
FROM "session";
