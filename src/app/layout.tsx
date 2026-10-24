import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { GlobalMounts } from '@/components/custom/global-mounts';
import { HeadContent } from '@/components/custom/head-content';
import { SiteFooter, SiteNav } from '@/components/custom/site-nav';
import { AppProviders } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/lib/fonts';
import { locale } from '@/lib/locale';
import { siteDescription, siteName, siteUrl } from '@/lib/site';
import { viewportConfig } from '@/lib/viewport-config';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    siteName,
    title: siteName,
    description: siteDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description: siteDescription,
  },
};

export const viewport: Viewport = { ...viewportConfig };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers() opts the route into dynamic rendering (per-request) —
  // required for the per-request CSP nonce set in proxy.ts.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    // One canvas, one look. Tilza ships a single warm marketplace system, so
    // <html> carries no theme attribute and no dark-mode class —
    // there is nothing for a theme provider to toggle. `suppressHydrationWarning`
    // stays because the browser extensions and next/font both mutate <html>
    // outside React.
    <html lang={locale.lang} dir={locale.dir} className={fontVariables} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-body text-foreground antialiased">
        <HeadContent nonce={nonce} />
        <AppProviders>
          <SiteNav />
          {children}
          <SiteFooter />
          <Toaster />
          <GlobalMounts />
        </AppProviders>
      </body>
    </html>
  );
}
