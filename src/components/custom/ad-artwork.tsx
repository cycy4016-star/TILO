// A generated ad image with a live, clickable call to action laid over it. The
// image is requested with ?cta=0 so the artwork's drawn-in pill is omitted and
// this real button is the only CTA; the image link still opens the published
// PNG (which keeps the drawn pill). Shared by the Ad Studio grid and slideshow.
'use client';

import { MessageCircle } from 'lucide-react';
import type { CSSProperties } from 'react';
import { type AdFormat, adImagePath } from '@/lib/ads';

// Where each format's CTA pill sits in the artwork, as a percentage of the
// image box — so the live button lands where the drawn one would have been.
// Matches the info panel's padding in the artwork route (60/76/68 px).
const CTA_INSET: Record<AdFormat['key'], string> = {
  square: 'left-[5.6%] bottom-[5.6%]',
  story: 'left-[7%] bottom-[7%]',
  wide: 'left-[57.7%] bottom-[10.8%]',
};

const CTA_SIZE = {
  card: 'gap-1.5 px-3 py-1.5 text-caption',
  stage: 'gap-2 px-4 py-2.5 text-small',
} as const;

export function AdArtwork({
  itemId,
  itemName,
  format,
  orderHref,
  orderLabel,
  size = 'card',
  priority = false,
  className,
  style,
}: {
  itemId: string;
  itemName: string;
  format: AdFormat;
  orderHref: string;
  orderLabel: string;
  size?: keyof typeof CTA_SIZE;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const imageUrl = adImagePath(itemId, format.key);
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
          alt={`Ad preview for ${itemName}`}
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
