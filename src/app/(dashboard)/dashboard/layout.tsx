// Tilza app code.

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/custom/dashboard/dashboard-shell';
import { getOnboardingStatus } from '@/lib/onboarding';
import { getSessionUser } from '@/lib/require-auth';
import { isAdminRole } from '@/lib/roles';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  // A platform operator owns no shop, so there is nothing to onboard. Forcing
  // them through /welcome would make store creation a prerequisite of the ops
  // console — the exact inversion of a master control system.
  if (isAdminRole(user.role)) return <DashboardShell>{children}</DashboardShell>;
  // Mandatory onboarding: a shop without identity, socials and a visual
  // finishes setup at /welcome before it can use the dashboard.
  const status = await getOnboardingStatus(user.id);
  if (!status.complete) redirect('/welcome');
  return <DashboardShell>{children}</DashboardShell>;
}
