import 'server-only';
import { prisma } from '@/lib/db';

export async function loadShopperOrderClaim(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: { userId: true, shopperId: true },
  });
}

export async function listShopperOrders(userId: string) {
  return prisma.order.findMany({
    where: { shopperId: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      amountPesewas: true,
      createdAt: true,
      user: { select: { store: { select: { name: true, slug: true } } } },
    },
  });
}
