// Shared visual tokens and text helpers for the generated ad artwork. Pure and
// client-safe, so both the next/og routes (server) and the Ad Studio islands
// reason about the same palette.
//
// THE AD IS A WHITE CARD. It used to be a dark navy panel with a gradient wash
// behind the product photo; like the storefront hero, it now earns its
// emphasis from the product itself and a hairline border. That means the
// generated artwork matches the shop a merchant is looking at — white page,
// white ad — instead of advertising in a colour that exists nowhere else.
//
// The two brand colours keep the same jobs they have everywhere else: BLUE is
// structural (the CTA pill), ORANGE is energy (the price). The price is the
// single thing a passer-by reads from three metres away, so it is the one
// element allowed to shout.
export const AD_CARD = '#ffffff'; // the ad's body
export const AD_TEXT = '#0a0a0a'; // primary ink on the card
export const AD_TEXT_DIM = 'rgba(10,10,10,0.55)'; // struck-through price, captions
// Product tiles (multi-product ad): card body + its caption strip.
export const AD_TILE = '#f4f4f4';
export const AD_TILE_FOOT = '#e8e8e8';

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
  /** Blue — the CTA pill fill, and the brand chip. */
  accent: string;
  /** Pale blue — the chip's quiet fill and the brand rule. */
  tint: string;
  /** Orange ink — the price, because the price is the message. */
  accentText: string;
  /** Text colour on top of an accent-filled pill. */
  pillText: string;
};

/**
 * The ad palette. It takes a theme key only for call-site compatibility —
 * there is one look now, so every shop gets the same blue and orange. The
 * luminance-based branches are gone: the colours are pinned literals, so their
 * contrast is known at authoring time (blue #2563eb under white text is 5.2:1;
 * orange #9a3412 on white is 7.3:1) rather than measured at render time.
 */
export function adPalette(_theme: string | null | undefined): AdPalette {
  return {
    accent: '#2563eb',
    tint: '#dbeafe',
    accentText: '#9a3412',
    pillText: '#ffffff',
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
