// Tilza app code.
//
// /manifest.webmanifest — colors come from `brandVisual` in src/lib/brand.ts; set them there.
import type { MetadataRoute } from 'next';
import { brandVisual } from '@/lib/brand';
import { siteDescription, siteName } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: siteName,
    short_name: siteName,
    description: siteDescription,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: brandVisual.backgroundColor,
    theme_color: brandVisual.themeColor,
    categories: ['business', 'shopping'],
    icons: [
      { src: '/icons/icon-192.png?v=2', type: 'image/png', sizes: '192x192', purpose: 'any' },
      { src: '/icons/icon-512.png?v=2', type: 'image/png', sizes: '512x512', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png?v=2',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Orders', short_name: 'Orders', url: '/dashboard/orders' },
      { name: 'Storefront', short_name: 'Storefront', url: '/dashboard/store' },
    ],
  };
}
