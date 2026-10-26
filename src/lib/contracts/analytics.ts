import { z } from 'zod';

export const StorefrontAnalytics = z.object({
  days: z.number().int().positive(),
  views: z.number().int().nonnegative(),
  visitors: z.number().int().nonnegative(),
  storefrontOrders: z.number().int().nonnegative(),
  storefrontRevenuePesewas: z.number().int().nonnegative(),
  leads: z.number().int().nonnegative(),
  conversionRate: z.number().nonnegative(),
  daily: z.array(
    z.object({
      day: z.string(),
      views: z.number().int().nonnegative(),
      visitors: z.number().int().nonnegative(),
      orders: z.number().int().nonnegative(),
    }),
  ),
  sources: z.array(
    z.object({
      source: z.string(),
      views: z.number().int().nonnegative(),
    }),
  ),
});

export type StorefrontAnalyticsValue = z.infer<typeof StorefrontAnalytics>;
