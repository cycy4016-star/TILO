import 'server-only';
import type { AudienceKind } from '@/lib/contracts/shopper';
import { prisma } from '@/lib/db';

export async function ensureAudience(userId: string, kind: AudienceKind): Promise<void> {
  await prisma.userAudience.upsert({
    where: { userId_kind: { userId, kind } },
    create: { userId, kind },
    update: {},
  });
}
