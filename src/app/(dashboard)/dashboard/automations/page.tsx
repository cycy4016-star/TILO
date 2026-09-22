// Static page shell; rules + activity load in the client island.
import type { Metadata } from 'next';
import { AutomationsWorkspace } from '@/components/custom/automations-workspace';

export const metadata: Metadata = {
  title: 'Switchboard',
  description: 'Set Tilo automation rules once and let them run.',
};

export default function AutomationsPage() {
  return <AutomationsWorkspace />;
}
