// Tilza app code.
//
// Shop analytics home. The route is gated server-side because the two roles
// need different rooms: a shop owner sees their own shop, a platform operator
// owns no shop at all and is sent to the cross-account console instead.

import { redirect } from 'next/navigation';
import { MerchantWorkspace } from '@/components/custom/dashboard/merchant-workspace';
import { getSessionUser } from '@/lib/require-auth';
import { isAdminRole } from '@/lib/roles';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  // This page reports one shop's numbers. For an operator they are empty by
  // definition, and the console is where their real work is.
  if (isAdminRole(user.role)) redirect('/dashboard/admin');
  return <MerchantWorkspace />;
}
