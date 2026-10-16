// Brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'Tilza';
export const siteDescription =
  'A shareable shop page for your products — categories, photos and prices, a basket customers fill themselves, and orders that land itemised in your dashboard.';

// Uploaded logo. Drop your file in /public (e.g. /public/logo.svg) and set this
// to its path (e.g. '/logo.svg'). While it is null, the app renders its built-in
// "TILZA" wordmark instead — see src/components/custom/tilza-logo.tsx.
export const brandLogo: string | null = null;

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
    tagline: 'Chat on WhatsApp. Run on Tilza.',
  },
} as const;
