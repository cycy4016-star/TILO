'use client';

// The shopper's own trail through this shop, kept on the device. Rendered above
// the catalogue toolbar so returning to a product is one tap, the way a
// marketplace behaves — but with no account and no server call.
import { Clock, Package } from 'lucide-react';
import Image from 'next/image';
import { formatGhs } from '@/lib/contracts/order';
import type { StorePublic } from '@/lib/contracts/store';

type CatalogItem = StorePublic['items'][number];

export function RecentlyViewed({
  items,
  onOpen,
}: {
  items: CatalogItem[];
  onOpen: (item: CatalogItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Recently viewed" className="grid gap-3">
      <div className="flex items-center gap-2">
        <Clock aria-hidden className="size-3.5 text-muted-foreground" />
        <h2 className="font-display text-h4 tracking-tight">Recently viewed</h2>
      </div>
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="group w-28 shrink-0 text-left"
          >
            <span className="relative block aspect-square overflow-hidden rounded-xl border border-border bg-muted">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  sizes="112px"
                  className="object-cover transition-transform duration-300 ease-out-expo group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Package aria-hidden className="size-7" />
                </span>
              )}
            </span>
            <span className="mt-1.5 line-clamp-2 block text-caption font-medium leading-snug text-foreground group-hover:text-primary">
              {item.name}
            </span>
            <span className="text-caption font-semibold text-primary">
              {formatGhs(item.pricePesewas)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
