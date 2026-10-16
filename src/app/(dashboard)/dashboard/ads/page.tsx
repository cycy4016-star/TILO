// Tilza Ad Studio page.
import type { Metadata } from 'next';
import { AdStudio } from '@/components/custom/ad-studio';

export const metadata: Metadata = {
  title: 'Ads',
  description: 'Ready-to-post ads for every product in your Tilza catalogue.',
};

export default function AdsPage() {
  return <AdStudio />;
}
