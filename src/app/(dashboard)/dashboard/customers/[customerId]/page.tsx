// Static page shell; customer data loads in the client island.
import type { Metadata } from 'next';
import { CustomerDetailWorkspace } from '@/components/custom/customer-detail-workspace';

export const metadata: Metadata = {
  title: 'Customer details',
  description: 'Review a Tilo customer and the orders connected to them.',
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  return <CustomerDetailWorkspace customerId={customerId} />;
}
