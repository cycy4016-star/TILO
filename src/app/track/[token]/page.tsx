// Account-free order tracking. The token in the URL is signed, so this page is
// public but only ever exposes the order it was minted for.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrderTracker } from '@/components/custom/storefront/order-tracker';
import { PublicOrderTracking } from '@/lib/contracts/public-store';
import { env } from '@/lib/env';
import { verifyOrderToken } from '@/lib/order-tracking';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Track your order',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type TrackPageProps = { params: Promise<{ token: string }> };

export default async function TrackOrderPage({ params }: TrackPageProps) {
  const { token } = await params;
  if (!verifyOrderToken(token)) notFound();

  const response = await fetch(
    `${env.BETTER_AUTH_URL}/api/public/orders/${encodeURIComponent(token)}`,
    { cache: 'no-store' },
  );
  if (!response.ok) notFound();

  const order = PublicOrderTracking.parse(await response.json());
  return <OrderTracker token={token} initial={order} />;
}
