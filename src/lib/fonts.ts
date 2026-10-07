// Tilo type system.
//
// Both faces are self-hosted by next/font: Next downloads them at build time
// and serves them from /_next/static, so the browser never talks to Google and
// the strict CSP in src/lib/csp.ts stays happy (next/font hosts are allowlisted
// there only as a build-time safety net).
//
// Each font exports a `variable` naming the CSS custom property it sets on
// <html>. src/app/globals.css then maps those onto the seed's two knobs:
//   --font-inter        -> --font-body   (UI, running text, form labels)
//   --font-inter-tight  -> --font-display (headlines, section titles, wordmark)
//
// Pairing rationale: Inter Tight is Inter's tighter, slightly higher-contrast
// cut — same skeleton, so the two never argue, but set tighter and heavier so a
// headline reads as *display* instead of oversized body copy. That contrast is
// what makes the hierarchy feel designed rather than merely sized.
import { Inter, Inter_Tight } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

export const interTight = Inter_Tight({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter-tight',
  fallback: ['system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

/** Class for <html> so both custom properties are in scope for the whole tree. */
export const fontVariables = [inter.variable, interTight.variable].join(' ');
