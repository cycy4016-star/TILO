// Tilo Admin monitor page: every account and their sign-in pulse. Platform-admin
// only: requireAdmin() now checks the role, so a signed-in shop owner who guesses
// this URL is redirected to their dashboard. This is the ONE page in the app that
// reads across shops.
import type { Metadata } from 'next';
import { AdminMonitor } from '@/components/custom/admin-monitor';
import { requireAdmin } from '@/lib/require-admin';

export const metadata: Metadata = {
  title: 'Admin',
  description: 'Every Tilo account and their sign-in activity.',
};

export default async function AdminPage() {
  await requireAdmin();
  return <AdminMonitor />;
}
