// Tilza's single look.
//
// TILZA HAS ONE APPEARANCE. There is no theme picker and no per-account colour
// choice: the platform ships one orange marketplace palette — light grey
// canvas, white cards, orange for actions and prices, red for discounts — and
// every surface in the product (marketing site, storefront, dashboard, ops
// console) renders that same system.
//
// WHY THIS FILE STILL EXISTS. `Store.theme`, `AppearancePreference.theme` and
// `Store.appearance` are real columns with real rows. They are NOT deleted here,
// because dropping them would mean a migration that rewrites history for no
// gain. Instead every write is pinned to the one key and every read is coerced
// to it, so a legacy row ("gold", "rose", "vibrant", …) still parses, still
// round-trips through the API, and simply renders as the one Tilza look. The
// enum in contracts/store.ts is the DB's shape and stays as-is; this module is
// where "which value do we actually honour" is answered.
//
// If the brand ever needs a second look, this is the only file that has to
// change to reintroduce one.
import { type AppearanceKeyValue, ThemeKey, type ThemeKeyValue } from '@/lib/contracts/store';

export type ThemePreset = {
  key: ThemeKeyValue;
  label: string;
  tagline: string;
  // Two preview colours for the swatch chip: the primary orange and the
  // brighter promo orange. Hardcoded because these mirror the pinned literals
  // in custom-style.css, not the oklch seed.
  accents: [string, string];
  seed: { h: number; c: number; l: number };
  flame: { h: number; c: number; l: number };
};

/** The only look. One entry, so any UI that maps over presets still renders. */
export const THEME_PRESETS: ThemePreset[] = [
  {
    key: 'blue',
    label: 'Tilza',
    tagline: 'Light canvas · orange marketplace · red for deals',
    accents: ['#cf4a00', '#fb7701'],
    seed: { h: 48, c: 0.19, l: 0.64 },
    flame: { h: 32, c: 0.22, l: 0.58 },
  },
];

export const DEFAULT_THEME: ThemeKeyValue = 'blue';

/**
 * Coerce any persisted value into the one theme Tilza honours.
 *
 * Previously this validated against the enum and passed the value through; now
 * every input — including a well-formed "gold" from an old row — collapses to
 * DEFAULT_THEME. The parameter is kept (rather than the function being deleted)
 * because the callers read a nullable DB column and the signature documents
 * that the answer is "no, it does not matter what was in the database".
 */
export function normalizeTheme(_value: string | null | undefined): ThemeKeyValue {
  return DEFAULT_THEME;
}

/**
 * Whether a persisted value is one the platform still recognises. Kept so the
 * one legacy spot that needs to tell "unknown junk" from "a valid old key"
 * (validation) can still ask, without this module having to pretend the old
 * keys are selectable.
 */
export function isKnownTheme(value: string | null | undefined): value is ThemeKeyValue {
  return ThemeKey.safeParse(value).success;
}

export function getThemePreset(_key: string | null | undefined): ThemePreset {
  return THEME_PRESETS[0] as ThemePreset;
}

export type AppearancePreset = {
  key: AppearanceKeyValue;
  label: string;
  tagline: string;
};

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    key: 'professional',
    label: 'Professional',
    tagline: 'Clean cards · the corporate standard',
  },
];

export const DEFAULT_APPEARANCE: AppearanceKeyValue = 'professional';

// The storefront renders one unified corporate layout, so every persisted
// appearance value normalizes to professional — including legacy "vibrant"
// rows, which keep rendering instead of breaking. AppearanceKey still parses
// "vibrant" so old writes validate; nothing reads it back as vibrant.
export function normalizeAppearance(_value: string | null | undefined): AppearanceKeyValue {
  return DEFAULT_APPEARANCE;
}
