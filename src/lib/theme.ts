// Colour theme + layout presets for the Tilo platform. Each theme preset is a
// set of seed values (--brand-h/c/l) injected into the CSS in globals.css under
// a `[data-theme="key"]` selector — the derived brand ramp and every semantic
// token recompute from those three numbers, so one pick recolours the whole
// dashboard coherently. Appearance presets switch between the loud Tilo panels
// (vibrant) and the clean business-ready default (professional); the default IS
// professional, and the neutralization lives in custom-style.css, gated to skip
// only [data-appearance="vibrant"]. The platform look is a per-user preference
// (src/app/api/appearance) chosen from the header AppearancePicker — it is NOT
// a store setting. The public storefront also uses these keys, but from the
// store's own values (Store.theme / Store.appearance), untouched by the user's
// personal platform preference.
//
// This module is CLIENT-SAFE: the swatch previews and labels drive the picker
// UI, and `normalizeTheme` / `normalizeAppearance` guard unknown persisted
// values so a bad string in the DB degrades to the defaults instead of breaking
// a page.
import {
  AppearanceKey,
  type AppearanceKeyValue,
  ThemeKey,
  type ThemeKeyValue,
} from '@/lib/contracts/store';

export type ThemePreset = {
  key: ThemeKeyValue;
  label: string;
  tagline: string;
  // Two preview colours for the swatch chip (brand-600 + brand-100, hardcoded
  // hues that approximate each preset — the real ramp comes from oklch seeds).
  accents: [string, string];
  seed: { h: number; c: number; l: number };
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: 'gold',
    label: 'Yellow',
    tagline: 'Vivid yellow · the Tilo signature',
    accents: ['#eab308', '#fef9c3'],
    seed: { h: 84, c: 0.19, l: 0.78 },
  },
  {
    key: 'emerald',
    label: 'Emerald',
    tagline: 'Fresh green · growth & money',
    accents: ['#059669', '#d1fae5'],
    seed: { h: 160, c: 0.2, l: 0.48 },
  },
  {
    key: 'ocean',
    label: 'Ocean',
    tagline: 'Deep blue · trust & calm',
    accents: ['#0e7490', '#cffafe'],
    seed: { h: 205, c: 0.22, l: 0.5 },
  },
  {
    key: 'violet',
    label: 'Violet',
    tagline: 'Royal purple · premium',
    accents: ['#7c3aed', '#ede9fe'],
    seed: { h: 268, c: 0.2, l: 0.5 },
  },
  {
    key: 'rose',
    label: 'Rose',
    tagline: 'Soft crimson · bold & warm',
    accents: ['#e11d48', '#ffe4e6'],
    seed: { h: 352, c: 0.2, l: 0.55 },
  },
  {
    key: 'slate',
    label: 'Slate',
    tagline: 'Grey · understated & clean',
    accents: ['#475569', '#e2e8f0'],
    seed: { h: 250, c: 0.02, l: 0.5 },
  },
];

export const DEFAULT_THEME: ThemeKeyValue = 'gold';

// Safely coerce any persisted value (string | null | undefined) into a valid
// theme key. Mirrors the DB default so unknown values fall back to gold.
export function normalizeTheme(value: string | null | undefined): ThemeKeyValue {
  const parsed = ThemeKey.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_THEME;
}

export function getThemePreset(key: string | null | undefined): ThemePreset {
  const normalized = normalizeTheme(key);
  return (
    THEME_PRESETS.find((preset) => preset.key === normalized) ?? (THEME_PRESETS[0] as ThemePreset)
  );
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
    tagline: 'Clean straight cards · understated & business-ready',
  },
  {
    key: 'vibrant',
    label: 'Vibrant',
    tagline: 'Loud yellow-black panels · the Tilo signature',
  },
];

export const DEFAULT_APPEARANCE: AppearanceKeyValue = 'professional';

// Safely coerce any persisted value into a valid appearance key. Mirrors the
// DB default so unknown values fall back to professional.
export function normalizeAppearance(value: string | null | undefined): AppearanceKeyValue {
  const parsed = AppearanceKey.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_APPEARANCE;
}
