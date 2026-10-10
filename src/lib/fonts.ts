// Tilo type system.
//
// Both faces are self-hosted by next/font: Next downloads them at build time
// and serves them from /_next/static, so the browser never talks to Google and
// the strict CSP in src/lib/csp.ts stays happy (next/font hosts are allowlisted
// there only as a build-time safety net).
//
// Each font exports a `variable` naming the CSS custom property it sets on
// <html>. src/app/globals.css then maps those onto the seed's two knobs:
//   --font-inter      -> --font-body   (UI, running text, form labels)
//   --font-display-face -> --font-display (headlines, section titles, wordmark)
//
// Pairing rationale: Inter is the invisible workhorse — neutral, high-legibility,
// perfect at 14px in a form label. Bricolage Grotesque is its opposite on
// purpose: a contemporary variable grotesque with slightly quirky curves and a
// tall x-height, so a headline reads as *display* — designed, a bit playful —
// instead of oversized body copy. That contrast is what makes the hierarchy
// feel intentional. Both are variable-weight, so the type scale's 600–720
// steps land on real optical weights rather than synthetic bolding.
import { Bricolage_Grotesque, Inter } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

export const displayFace = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display-face',
  fallback: ['system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

/** Class for <html> so both custom properties are in scope for the whole tree. */
export const fontVariables = [inter.variable, displayFace.variable].join(' ');
