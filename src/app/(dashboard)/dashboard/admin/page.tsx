// Tilo Admin monitor page: every account and their sign-in pulse. Admin-only:
// the server gate redirects anyone who isn't a boss away from this route.
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
