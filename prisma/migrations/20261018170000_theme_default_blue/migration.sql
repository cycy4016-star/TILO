-- Blue becomes the platform default theme. Existing rows keep whatever key
-- they saved (orange and gold remain valid presets), only the defaults move.
ALTER TABLE "AppearancePreference" ALTER COLUMN "theme" SET DEFAULT 'blue';
ALTER TABLE "Store" ALTER COLUMN "theme" SET DEFAULT 'blue';
