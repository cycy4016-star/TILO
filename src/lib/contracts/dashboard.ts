// Client-safe dashboard overview contract shared by route and island.
import { z } from 'zod';
import { OrderStatus } from '@/lib/contracts/order';

export const DashboardOverview = z.object({
  // Money still sitting in unfinished orders: amount set, not paid, not cancelled.
  outstandingPesewas: z.number().int().nonnegative(),
  outstandingCount: z.number().int().nonnegative(),
  oldestOutstandingDays: z.number().int().nonnegative().nullable(),
  // Money that landed this month (paidAt within the current calendar month).
  recoveredMonthPesewas: z.number().int().nonnegative(),
  recoveredMonthCount: z.number().int().nonnegative(),
  // The oldest outstanding orders, one per row for the "chase" list.
  topChases: z.array(
    z.object({
      orderId: z.string(),
      orderNumber: z.string(),
      customerId: z.string(),
      customerName: z.string(),
      customerPhone: z.string().nullable(),
      description: z.string(),
      amountPesewas: z.number().int().nonnegative(),
      ageDays: z.number().int().nonnegative(),
      status: OrderStatus,
    }),
  ),
});

export type DashboardOverview = z.infer<typeof DashboardOverview>;
