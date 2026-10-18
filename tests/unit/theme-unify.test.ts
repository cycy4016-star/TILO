// Corporate unification tests: the platform defaults to a clean royal blue
// and every stored appearance normalizes to the single corporate layout,
// including legacy "vibrant" rows.
import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  getThemePreset,
  normalizeAppearance,
  normalizeTheme,
  THEME_PRESETS,
} from '@/lib/theme';

describe('corporate theme defaults', () => {
  it('ships blue as the bright default', () => {
    expect(DEFAULT_THEME).toBe('blue');
    expect(getThemePreset(undefined).key).toBe('blue');
    expect(normalizeTheme('nope')).toBe('blue');
    expect(normalizeTheme('ocean')).toBe('ocean');
  });

  it('lists blue first in the picker', () => {
    expect(APPEARANCE_PRESETS.length).toBeGreaterThan(0);
    expect(THEME_PRESETS[0]?.key).toBe('blue');
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
