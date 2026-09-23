// Tilo Products analytics page: what moves, and what earns.
import type { Metadata } from 'next';
import { ProductsWorkspace } from '@/components/custom/products-workspace';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Best-sellers, prices, costs and margins at a glance.',
};

export default function ProductsPage() {
  return <ProductsWorkspace />;
}
