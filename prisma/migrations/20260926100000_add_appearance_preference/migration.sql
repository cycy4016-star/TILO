-- Tilo app code.
-- Forward-only. Adds per-user platform appearance: each signed-in account's
-- own color theme + layout preset for the whole dashboard/app. Deliberately
-- separate from the Store (the public storefront keeps its own look from
-- Store.theme / Store.appearance). Mirrors prisma/schema/appearance.prisma:
-- physical table name matches the model name (@@map is NOT used here).

-- CreateTable
CREATE TABLE "AppearancePreference" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "theme"      TEXT NOT NULL DEFAULT 'gold',
    "appearance" TEXT NOT NULL DEFAULT 'vibrant',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppearancePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppearancePreference_userId_key" ON "AppearancePreference"("userId");