// Dashboards orders hub: every order in one live list.
import type { Metadata } from 'next';
import { OrdersWorkspace } from '@/components/custom/orders/orders-workspace';

export const metadata: Metadata = { title: 'Orders' };

export default function OrdersPage() {
  return <OrdersWorkspace />;
}
