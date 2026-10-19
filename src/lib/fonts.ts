// Tilza type system.
//
// Two faces, both self-hosted by next/font: Next downloads them at build time
// and serves them from /_next/static, so the browser never talks to Google and
// the strict CSP in src/lib/csp.ts stays happy (next/font hosts are allowlisted
// there only as a build-time safety net).
//
//   --font-inter -> --font-body and --font-display (ONE family, two roles)
//   --font-mono  -> tabular data, codes, IDs, money
//
// Inter is the whole voice. Hierarchy comes from size, weight and tracking on a
// single family — not from a novelty display face. A second decorative face
// applied across every heading is the single loudest "template" signal in a
// product UI; it fights the body text instead of framing it, and it stops
// looking deliberate the moment a heading wraps. Where a large heading needs
// presence, it gets tighter tracking and more weight (see the type scale in
// src/app/globals.css), which is how real product typography handles emphasis.
//
// JetBrains Mono is reserved for data that benefits from column alignment:
// prices, quantities, timestamps, IDs, hashes. Using it for UI text would be
// noise, so it stays opt-in via `font-mono` at call sites.
import { Inter, JetBrains_Mono } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

export const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-face',
  fallback: ['ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
});

/** Class for <html> so every custom property is in scope for the whole tree. */
export const fontVariables = [inter.variable, mono.variable].join(' ');
