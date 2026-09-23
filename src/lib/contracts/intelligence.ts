// Client-safe owner Intelligence contract shared by the route and the island:
// the "balance sheet" of the business — money lanes, catalog economics, and
// realized margins from productized order lines.
import { z } from 'zod';

export const DashboardIntelligence = z.object({
  // Money lanes (same shape as the overview card).
  moneyInMonthPesewas: z.number().int().nonnegative(),
  moneyInMonthCount: z.number().int().nonnegative(),
  outstandingPesewas: z.number().int().nonnegative(),
  outstandingCount: z.number().int().nonnegative(),

  // Catalog economics: what the shelf holds at cost vs what it retails for.
  catalogItemCount: z.number().int().nonnegative(),
  catalogCostPesewas: z.number().int().nonnegative(),
  catalogSellPesewas: z.number().int().nonnegative(),
  catalogProfitPesewas: z.number().int().nonnegative(),
  catalogMarginPercent: z.number().int().nonnegative(),
  itemsMissingCost: z.number().int().nonnegative(),

  // Realized sales from productized lines on non-cancelled orders.
  realizedRevenuePesewas: z.number().int().nonnegative(),
  realizedCogsPesewas: z.number().int().nonnegative(),
  realizedProfitPesewas: z.number().int(),
  realizedMarginPercent: z.number().int().nullable(),
  realizedOrderCount: z.number().int().nonnegative(),
  realizedUnitCount: z.number().int().nonnegative(),

  // The products that earned the most profit, ranked.
  topItems: z.array(
    z.object({
      name: z.string(),
      unitCount: z.number().int().nonnegative(),
      revenuePesewas: z.number().int().nonnegative(),
      cogsPesewas: z.number().int().nonnegative(),
      profitPesewas: z.number().int(),
      marginPercent: z.number().int().nullable(),
    }),
  ),
});

export type DashboardIntelligence = z.infer<typeof DashboardIntelligence>;
