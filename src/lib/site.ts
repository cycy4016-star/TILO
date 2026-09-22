// Centralized site identity for the SEO metadata routes (robots.ts, sitemap.ts,
// manifest.ts) and the root layout's default Open Graph / Twitter / canonical
// metadata.
import { env } from '@/lib/env';

// Absolute public origin for SEO (metadataBase, canonical, robots, sitemap, OG).
// Reuses the app's single validated public origin — NEXT_PUBLIC_APP_URL — so one
// deploy var covers both the app and SEO.
export const siteUrl = (env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

// Brand identity (name + description) lives in src/lib/brand.ts and is
// re-exported here so SEO plumbing and existing `@/lib/site` imports keep a
// single entry point.
export { siteDescription, siteName } from '@/lib/brand';
