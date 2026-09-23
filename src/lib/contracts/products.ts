// Client-safe Products analytics contract shared by the route and the island:
// per-item sales volume, revenue, cost, profit and live price comparison.
import { z } from 'zod';
import { StoreItemKind } from '@/lib/contracts/store';

export const DashboardProductRow = z.object({
  // Snapshot name from the order line (renames don't rewrite history).
  name: z.string(),
  kind: StoreItemKind.nullable(),
  // Live catalog data, null once the item is deleted (snapshots survive).
  active: z.boolean().nullable(),
  currentPricePesewas: z.number().int().nonnegative().nullable(),
  currentCostPesewas: z.number().int().nonnegative().nullable(),
  unitCount: z.number().int().nonnegative(),
  orderCount: z.number().int().nonnegative(),
  revenuePesewas: z.number().int().nonnegative(),
  cogsPesewas: z.number().int().nonnegative(),
  profitPesewas: z.number().int(),
  marginPercent: z.number().int().nullable(),
  lastSoldAt: z.string().datetime().nullable(),
});

export const DashboardProducts = z.object({
  items: z.array(DashboardProductRow),
});

export type DashboardProductRow = z.infer<typeof DashboardProductRow>;
export type DashboardProducts = z.infer<typeof DashboardProducts>;
