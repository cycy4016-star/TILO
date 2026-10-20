// One-look tests. Tilza no longer offers a colour choice: the platform ships a
// single orange marketplace palette on a light canvas, and every stored theme
// key — including legacy rows from the nine-preset era — collapses to that one
// look. The appearance value is likewise pinned, including legacy "vibrant"
// rows.
import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  getThemePreset,
  isKnownTheme,
  normalizeAppearance,
  normalizeTheme,
  THEME_PRESETS,
} from '@/lib/theme';

describe('one Tilza look', () => {
  it('ships the single default theme', () => {
    expect(DEFAULT_THEME).toBe('blue');
    expect(getThemePreset(undefined).key).toBe('blue');
    expect(normalizeTheme(null)).toBe('blue');
    expect(normalizeTheme(undefined)).toBe('blue');
    expect(normalizeTheme('nope')).toBe('blue');
  });

  // The behaviour that changed: a legacy key used to pass through and recolour
  // the platform. It now resolves to the one look, because no [data-theme]
  // selector exists to honour it and shipping a half-dead palette is worse than
  // shipping none.
  it('collapses every legacy theme key to the single look', () => {
    expect(normalizeTheme('ocean')).toBe('blue');
    expect(normalizeTheme('gold')).toBe('blue');
    expect(normalizeTheme('rose')).toBe('blue');
    expect(normalizeTheme('orange')).toBe('blue');
    expect(normalizeTheme('blue')).toBe('blue');
  });

  it('still recognises legacy keys as valid DB values', () => {
    // The column keeps its old enum so old rows parse and round-trip; they just
    // no longer select a palette.
    expect(isKnownTheme('ocean')).toBe(true);
    expect(isKnownTheme('gold')).toBe(true);
    expect(isKnownTheme('nope')).toBe(false);
    expect(isKnownTheme(null)).toBe(false);
  });

  it('offers exactly one colour, and it carries both brand colours', () => {
    expect(THEME_PRESETS).toHaveLength(1);
    expect(THEME_PRESETS[0]?.key).toBe('blue');
    // [primary orange, promo orange] — the swatch shows the platform palette.
    expect(THEME_PRESETS[0]?.accents).toEqual(['#cf4a00', '#fb7701']);
  });
});

describe('appearance unification', () => {
  it('coerces every value to the single corporate layout', () => {
    expect(DEFAULT_APPEARANCE).toBe('professional');
    expect(normalizeAppearance('vibrant')).toBe('professional');
    expect(normalizeAppearance('professional')).toBe('professional');
    expect(normalizeAppearance(null)).toBe('professional');
    expect(normalizeAppearance('nope')).toBe('professional');
  });

  it('offers no alternate appearance to pick', () => {
    expect(APPEARANCE_PRESETS.map((preset) => preset.key)).toEqual(['professional']);
  });
});
