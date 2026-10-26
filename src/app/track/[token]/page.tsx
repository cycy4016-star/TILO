// Account-free order tracking. The token in the URL is signed, so this page is
// public but only ever exposes the order it was minted for.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrderTracker } from '@/components/custom/storefront/order-tracker';
import { PublicOrderTracking } from '@/lib/contracts/public-store';
import { env } from '@/lib/env';
import { resolveShopperClaimState } from '@/lib/order-claim';
import { verifyOrderToken } from '@/lib/order-tracking';
import { getSessionUser } from '@/lib/require-auth';
import { loadShopperOrderClaim } from '@/lib/shopper-orders';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Track your order',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type TrackPageProps = { params: Promise<{ token: string }> };

export default async function TrackOrderPage({ params }: TrackPageProps) {
  const { token } = await params;
  const orderId = verifyOrderToken(token);
  if (!orderId) notFound();

  const [response, viewer, claim] = await Promise.all([
    fetch(`${env.BETTER_AUTH_URL}/api/public/orders/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    }),
    getSessionUser(),
    loadShopperOrderClaim(orderId),
  ]);
  if (!response.ok || !claim) notFound();

  const order = PublicOrderTracking.parse(await response.json());
  const claimState = resolveShopperClaimState({
    orderUserId: claim.userId,
    shopperId: claim.shopperId,
    viewerId: viewer?.id ?? null,
  });
  const googleEnabled =
    env.NEXT_PUBLIC_GOOGLE_AUTH === 'true' &&
    Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  return (
    <OrderTracker
      token={token}
      initial={order}
      claimState={claimState}
      viewerEmail={viewer?.email ?? null}
      googleEnabled={googleEnabled}
    />
  );
}
