// Public rider gig page. Unindexed by design: the merchant shares the link in
// their rider network after broadcasting the order. No account is required.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RiderJob } from '@/components/custom/delivery/rider-job';
import { RiderJobResult } from '@/lib/contracts/delivery';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Delivery gig',
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ orderSlug: string }> };

export default async function RiderJobPage({ params }: PageProps) {
  const { orderSlug } = await params;
  // DB access stays in the API route; this server page only shapes the public
  // payload into the rider island.
  const res = await fetch(
    `${env.BETTER_AUTH_URL}/api/public/delivery/jobs/${encodeURIComponent(orderSlug)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) notFound();
  const job = RiderJobResult.parse(await res.json());
  return <RiderJob job={job} />;
}
