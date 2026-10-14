// Corporate unification tests: the platform defaults to a bright marketplace
// orange and every stored appearance normalizes to the single corporate layout,
// including legacy "vibrant" rows.
import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  getThemePreset,
  normalizeAppearance,
  normalizeTheme,
} from '@/lib/theme';

describe('corporate theme defaults', () => {
  it('ships orange as the bright default', () => {
    expect(DEFAULT_THEME).toBe('orange');
    expect(getThemePreset(undefined).key).toBe('orange');
    expect(normalizeTheme('nope')).toBe('orange');
    expect(normalizeTheme('ocean')).toBe('ocean');
  });

  it('lists orange first in the picker', () => {
    expect(APPEARANCE_PRESETS.length).toBeGreaterThan(0);
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
