// Tilo app code.

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/custom/dashboard/dashboard-shell';
import { getOnboardingStatus } from '@/lib/onboarding';
import { getSessionUser } from '@/lib/require-auth';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  // Mandatory onboarding: a shop without identity, socials and a visual
  // finishes setup at /welcome before it can use the dashboard.
  const status = await getOnboardingStatus(user.id);
  if (!status.complete) redirect('/welcome');
  return <DashboardShell>{children}</DashboardShell>;
}
