import type { Metadata } from 'next';
import { DeliveryCrewWorkspace } from '@/components/custom/delivery/delivery-crew-workspace';

export const metadata: Metadata = {
  title: 'Delivery crew',
  description: 'Approve riders and dispatch local deliveries to your own crew.',
};

export default function DeliveryPage() {
  return <DeliveryCrewWorkspace />;
}
