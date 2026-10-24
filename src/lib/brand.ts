// Brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'Tilza';
export const siteDescription =
  'Put your products online, share one link, and take orders. Customers browse your shop and fill a basket; every order lands in your dashboard and on WhatsApp.';

// Uploaded logo. While it is null, the app renders its built-in "TILZA"
// wordmark instead — see src/components/custom/tilza-logo.tsx.
export const brandLogo: string | null = '/brand/tilza-logo.png';
// Knockout variant for ink/dark surfaces (Terminal masthead).
export const brandLogoLight: string | null = '/brand/tilza-logo-light.png';

// PWA + social-share colors. HEX only — set to match the orange marketplace
// palette in custom-style.css.
export const brandVisual = {
  /** PWA browser-UI / status-bar color. The brand orange. */
  themeColor: '#cf4a00',
  /** PWA splash + install background. Warm brand canvas. */
  backgroundColor: '#fffaf5',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#ffffff',
    foreground: '#171717',
    /** Second line under the site name; '' hides it. */
    tagline: 'Your shop. One link. Orders on WhatsApp.',
  },
} as const;
