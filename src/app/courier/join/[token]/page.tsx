import type { Metadata } from 'next';
import { CourierJoinForm } from '@/components/custom/courier/courier-join-form';

export const metadata: Metadata = {
  title: 'Join a delivery crew',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type JoinPageProps = { params: Promise<{ token: string }> };

export default async function CourierJoinPage({ params }: JoinPageProps) {
  const { token } = await params;
  return <CourierJoinForm token={token} />;
}
