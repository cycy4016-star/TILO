// Shared visual tokens and text helpers for the generated ad artwork. Pure and
// client-safe, so both the next/og routes (server) and the Ad Studio islands
// reason about the same palette — a dark brand accent must never paint
// dark-on-dark text, wherever the colour is chosen.
import { getThemePreset } from '@/lib/theme';

export const AD_INK = '#0f172a';
export const AD_PANEL = '#101a2e';
export const AD_PAPER = '#f8fafc';
// Product tiles (multi-product ad): card body + its caption strip.
export const AD_TILE = '#1c2942';
export const AD_TILE_FOOT = '#111c33';

/** Relative luminance of a #rrggbb colour (WCAG). */
export function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export type AdPalette = {
  accent: string;
  tint: string;
  /** Accent colour to use for text on the dark card. */
  accentText: string;
  /** Text colour to use on top of an accent-filled pill. */
  pillText: string;
};

export function adPalette(theme: string | null | undefined): AdPalette {
  const preset = getThemePreset(theme);
  const accent = preset.accents[0];
  const tint = preset.accents[1];
  return {
    accent,
    tint,
    accentText: luminance(accent) < 0.16 ? tint : accent,
    pillText: luminance(accent) < 0.5 ? AD_PAPER : AD_INK,
  };
}

/** Tiered name sizing so long names never overflow a fixed panel. */
export function nameFontSize(name: string, base: number): number {
  const length = name.trim().length;
  if (length <= 18) return base;
  if (length <= 30) return Math.round(base * 0.84);
  if (length <= 44) return Math.round(base * 0.68);
  return Math.round(base * 0.56);
}

/** Trim to a length, ending on an ellipsis when it was cut. */
export function clampText(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}
