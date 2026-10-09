// Colour theme for the Tilo platform. Each theme preset is a
// set of seed values (--brand-h/c/l) injected into the CSS in globals.css under
// a `[data-theme="key"]` selector — the derived brand ramp and every semantic
// token recompute from those three numbers, so one pick recolours the whole
// dashboard coherently. The corporate default is Slate (neutral grey); shops
// and users may still pick a brand colour from the picker, but every surface
// ships slate-first. The storefront renders one unified corporate layout —
// there is no alternate appearance anymore (see normalizeAppearance).
//
// This module is CLIENT-SAFE: the swatch previews and labels drive the picker
// UI, and `normalizeTheme` guards unknown persisted values so a bad string in
// the DB degrades to the default instead of breaking a page.
import { type AppearanceKeyValue, ThemeKey, type ThemeKeyValue } from '@/lib/contracts/store';

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
    key: 'slate',
    label: 'Slate',
    tagline: 'Neutral grey · the corporate default',
    accents: ['#475569', '#e2e8f0'],
    seed: { h: 250, c: 0.02, l: 0.5 },
  },
  {
    key: 'ocean',
    label: 'Ocean',
    tagline: 'Deep blue · trust and calm',
    accents: ['#0e7490', '#cffafe'],
    seed: { h: 205, c: 0.22, l: 0.5 },
  },
  {
    key: 'emerald',
    label: 'Emerald',
    tagline: 'Fresh green · growth and clarity',
    accents: ['#059669', '#d1fae5'],
    seed: { h: 160, c: 0.2, l: 0.48 },
  },
  {
    key: 'ember',
    label: 'Ember',
    tagline: 'Warm orange · energetic',
    accents: ['#ea580c', '#ffedd5'],
    seed: { h: 45, c: 0.2, l: 0.53 },
  },
  {
    key: 'gold',
    label: 'Gold',
    tagline: 'Signature yellow · the original Tilo brand',
    accents: ['#eab308', '#fef9c3'],
    seed: { h: 84, c: 0.19, l: 0.78 },
  },
  {
    key: 'violet',
    label: 'Violet',
    tagline: 'Purple · distinctive',
    accents: ['#7c3aed', '#ede9fe'],
    seed: { h: 268, c: 0.2, l: 0.5 },
  },
  {
    key: 'rose',
    label: 'Rose',
    tagline: 'Crimson · bold',
    accents: ['#e11d48', '#ffe4e6'],
    seed: { h: 352, c: 0.2, l: 0.55 },
  },
];

export const DEFAULT_THEME: ThemeKeyValue = 'slate';

// Safely coerce any persisted value (string | null | undefined) into a valid
// theme key. Mirrors the DB default so unknown values fall back to slate.
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
