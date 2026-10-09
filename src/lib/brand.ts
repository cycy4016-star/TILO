// Brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'Tilo';
export const siteDescription =
  'A shareable shop page for your products — categories, photos and prices, a basket customers fill themselves, and orders that land itemised in your dashboard.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match the corporate slate default.
export const brandVisual = {
  /** PWA browser-UI / status-bar color. */
  themeColor: '#475569',
  /** PWA splash + install background. */
  backgroundColor: '#f8fafc',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#0f172a',
    foreground: '#f8fafc',
    /** Second line under the site name; '' hides it. */
    tagline: 'Chat on WhatsApp. Run on Tilo.',
  },
} as const;
