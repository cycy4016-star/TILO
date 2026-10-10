// Static page shell; settings data loads in the client island.
import type { Metadata } from 'next';
import { SettingsWorkspace } from '@/components/custom/settings-workspace';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Social links, storefront address and account settings for your Tilo shop.',
};

export default function SettingsPage() {
  return <SettingsWorkspace />;
}
