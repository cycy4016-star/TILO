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
// readable here) — set to match the white + blue + orange system in
// custom-style.css.
export const brandVisual = {
  /** PWA browser-UI / status-bar color. The blue — structure. */
  themeColor: '#2563eb',
  /** PWA splash + install background. Pure white canvas. */
  backgroundColor: '#ffffff',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#ffffff',
    foreground: '#0a0a0a',
    /** Second line under the site name; '' hides it. */
    tagline: 'Chat on WhatsApp. Run on Tilza.',
  },
} as const;
