// Corporate unification tests: the platform defaults to neutral slate and
// every stored appearance normalizes to the single corporate layout,
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
  it('ships slate as the neutral default', () => {
    expect(DEFAULT_THEME).toBe('slate');
    expect(getThemePreset(undefined).key).toBe('slate');
    expect(normalizeTheme('nope')).toBe('slate');
    expect(normalizeTheme('ocean')).toBe('ocean');
  });

  it('lists slate first in the picker', () => {
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
