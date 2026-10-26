import { z } from 'zod';

export const AudienceKind = z.enum(['OWNER', 'COURIER', 'SHOPPER']);
export type AudienceKind = z.infer<typeof AudienceKind>;

export const ShopperClaimState = z.enum([
  'signed-out',
  'claimable',
  'claimed',
  'claimed-other',
  'owner',
]);
export type ShopperClaimState = z.infer<typeof ShopperClaimState>;

export const OrderClaimResult = z.object({
  ok: z.literal(true),
});
export type OrderClaimResult = z.infer<typeof OrderClaimResult>;
