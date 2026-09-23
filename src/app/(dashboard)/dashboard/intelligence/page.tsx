// Tilo Intelligence page: the owner's balance sheet.
import type { Metadata } from 'next';
import { IntelligenceWorkspace } from '@/components/custom/intelligence-workspace';

export const metadata: Metadata = {
  title: 'Intelligence',
  description: 'Costs, prices, profits and the business balance sheet.',
};

export default function IntelligencePage() {
  return <IntelligenceWorkspace />;
}
