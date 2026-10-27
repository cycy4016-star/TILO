import 'server-only';
import { prisma } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export type AppHomeUser = {
  id: string;
  role?: string | null;
};

export async function resolveAppHome(user: AppHomeUser): Promise<string> {
  if (isAdminRole(user.role)) return '/dashboard/admin';

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      store: { select: { id: true } },
      audiences: { where: { kind: 'SHOPPER' }, select: { id: true }, take: 1 },
    },
  });

  if (record?.store) return '/dashboard';
  if (record?.audiences.length) return '/orders';
  return '/welcome';
}
