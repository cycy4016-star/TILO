// The always-on basket pill: floats above the page bottom whenever the basket
// has something in it, totals the lot, and opens the checkout dialog. Painted
// with the shop's own theme ramp so it reads as part of the shop, not Tilza.
'use client';

import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatGhs } from '@/lib/contracts/order';

export function BasketBar({
  count,
  total,
  onCheckout,
}: {
  count: number;
  total: number;
  onCheckout: () => void;
}) {
  if (count <= 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="pointer-events-auto mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-lg border border-border bg-card/95 p-2.5 pl-4 shadow-xl backdrop-blur">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-highlight font-display text-h4 font-bold text-highlight-foreground">
            {count}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-caption font-semibold text-muted-foreground">
              {count === 1 ? 'item' : 'items'} in your basket
            </span>
            <span className="block font-display text-h4 font-bold">{formatGhs(total)}</span>
          </span>
        </span>
        <Button
          type="button"
          onClick={onCheckout}
          className="h-11 shrink-0 items-center gap-2 rounded-md bg-primary px-5 font-bold text-primary-foreground shadow-sm transition-transform hover:bg-primary/90 active:scale-[0.98]"
        >
          <ShoppingCart aria-hidden className="size-4" /> Checkout
        </Button>
      </div>
    </div>
  );
}
