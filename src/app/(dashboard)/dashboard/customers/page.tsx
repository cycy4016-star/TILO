// Static page shell; customer data loads in the client island.
import type { Metadata } from 'next';
import { CustomerWorkspace } from '@/components/custom/customer-workspace';

export const metadata: Metadata = {
  title: 'Customers',
  description: 'Search and manage Tilo customer records.',
};

export default function CustomersPage() {
  return <CustomerWorkspace />;
}
