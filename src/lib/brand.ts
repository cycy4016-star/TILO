// Brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'Tilo';
export const siteDescription =
  'The vibrant workspace for chat-led businesses — customers, orders, and follow-up in one place.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match your brand seed.
export const brandVisual = {
  /** PWA browser-UI / status-bar color. */
  themeColor: '#b45309',
  /** PWA splash + install background. */
  backgroundColor: '#fffbeb',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#451a03',
    foreground: '#fffbeb',
    /** Second line under the site name; '' hides it. */
    tagline: 'Chat on WhatsApp. Run on Tilo.',
  },
} as const;
