import type { ShopperClaimState } from '@/lib/contracts/shopper';

export function resolveShopperClaimState({
  orderUserId,
  shopperId,
  viewerId,
}: {
  orderUserId: string;
  shopperId: string | null;
  viewerId: string | null;
}): ShopperClaimState {
  if (viewerId && viewerId === orderUserId) return 'owner';
  if (shopperId) return viewerId === shopperId ? 'claimed' : 'claimed-other';
  return viewerId ? 'claimable' : 'signed-out';
}
