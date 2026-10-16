// Tilza store manager page.
import type { Metadata } from 'next';
import { StoreWorkspace } from '@/components/custom/store-workspace';

export const metadata: Metadata = {
  title: 'Store',
  description: 'Run the Tilza storefront: your public page and product catalog.',
};

export default function StorePage() {
  return <StoreWorkspace />;
}
