// A multi-product ad image (several listings in one card) with a live,
// clickable shop-wide call to action laid over it. Mirrors AdArtwork: the image
// is requested with ?cta=0 so the artwork's drawn-in pill is omitted and this
// real button is the only CTA.
'use client';

import { MessageCircle } from 'lucide-react';
import type { CSSProperties } from 'react';
import { type AdFormat, carouselAdPath } from '@/lib/ads';

// Where the footer CTA sits in the artwork, as a percentage of the image box.
// Matches the footer padding in the carousel route (52/60/40 px).
const CTA_INSET: Record<AdFormat['key'], string> = {
  square: 'left-[4.8%] bottom-[4.8%]',
  story: 'left-[5.6%] bottom-[3.1%]',
  wide: 'left-[3.3%] bottom-[6.3%]',
};

const CTA_SIZE = {
  card: 'gap-1.5 px-3 py-1.5 text-caption',
  stage: 'gap-2 px-4 py-2.5 text-small',
} as const;

export function AdCarousel({
  slug,
  itemIds,
  format,
  orderHref,
  orderLabel,
  size = 'card',
  priority = false,
  className,
  style,
}: {
  slug: string;
  itemIds: string[];
  format: AdFormat;
  orderHref: string;
  orderLabel: string;
  size?: keyof typeof CTA_SIZE;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const imageUrl = carouselAdPath(slug, itemIds, format.key);
  const previewUrl = `${imageUrl}&cta=0`;
  return (
    <div
      className={`relative overflow-hidden bg-muted ${className ?? ''}`}
      style={{ aspectRatio: `${format.width} / ${format.height}`, ...style }}
    >
      <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
        {/* biome-ignore lint/performance/noImgElement: dynamic next/og image, not a static asset. */}
        <img
          src={previewUrl}
          alt="Multi-product ad preview"
          loading={priority ? 'eager' : 'lazy'}
          className="h-full w-full object-cover"
        />
      </a>
      <a
        href={orderHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`absolute inline-flex items-center rounded-full bg-emerald-600 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 ${CTA_SIZE[size]} ${CTA_INSET[format.key]}`}
      >
        <MessageCircle aria-hidden className={size === 'stage' ? 'size-4' : 'size-3.5'} />
        {orderLabel}
      </a>
    </div>
  );
}
