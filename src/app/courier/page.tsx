import type { Metadata, Viewport } from 'next';
import { CourierWorkspace } from '@/components/custom/courier/courier-workspace';
import { brandVisual } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Tilza Courier',
  description: 'Your private delivery jobs for approved shops.',
  manifest: '/courier/manifest.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Tilza Courier', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: brandVisual.themeColor,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function CourierPage() {
  return <CourierWorkspace />;
}
