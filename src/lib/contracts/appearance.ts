// Client-safe contracts for the per-user platform appearance preference: the
// color theme + layout preset the whole dashboard/app renders in. One row per
// signed-in user (see prisma/schema/appearance.prisma); created lazily and
// always responds with valid keys (ThemeKey/AppearanceKey live in the store
// contract file — they are shared allowlists for both the platform and the
// public storefront).
import { z } from 'zod';
import { AppearanceKey, ThemeKey } from '@/lib/contracts/store';

// PUT body: any subset of the two preference fields. Absent = leave as is.
export const AppearancePreferenceUpsert = z.object({
  theme: ThemeKey.optional(),
  appearance: AppearanceKey.optional(),
});

// Wire shape returned by GET/PUT — always fully-qualified keys.
export const AppearancePreferencePayload = z.object({
  theme: ThemeKey,
  appearance: AppearanceKey,
});

export type AppearancePreferenceUpsertInput = z.infer<typeof AppearancePreferenceUpsert>;
export type AppearancePreferencePayload = z.infer<typeof AppearancePreferencePayload>;
