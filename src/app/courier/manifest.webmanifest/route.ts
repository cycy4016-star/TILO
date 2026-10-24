import type { MetadataRoute } from 'next';
import { brandVisual } from '@/lib/brand';

const manifest: MetadataRoute.Manifest = {
  id: '/courier',
  name: 'Tilza Courier',
  short_name: 'Courier',
  description: 'Private delivery jobs for approved Tilza shops.',
  start_url: '/courier',
  scope: '/courier',
  display: 'standalone',
  background_color: brandVisual.backgroundColor,
  theme_color: brandVisual.themeColor,
  categories: ['business', 'productivity'],
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
};

export function GET() {
  return Response.json(manifest, {
    headers: {
      'content-type': 'application/manifest+json',
      'cache-control': 'public, max-age=3600',
    },
  });
}
