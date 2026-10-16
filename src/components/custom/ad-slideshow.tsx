// Ad slideshow: today's ads, one at a time, large — with the live "Order on
// WhatsApp" button laid over each one, arrow/dot navigation, and optional
// autoplay. It's the "show me them in action" view: each ad is a full-bleed
// preview of exactly what a customer would tap.
'use client';

import { ChevronLeft, ChevronRight, Download, Pause, Play, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdArtwork } from '@/components/custom/ad-artwork';
import { downloadAdImage } from '@/components/custom/ad-post-sheet';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AD_FORMATS, type AdFormat, adImagePath, adOrderAction } from '@/lib/ads';
import type { AdDraft, AdFeed } from '@/lib/contracts/ads';
import { formatGhs } from '@/lib/contracts/order';

const AUTOPLAY_MS = 4500;

function ArrowButton({
  side,
  label,
  onClick,
}: {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background ${
        side === 'left' ? 'left-2' : 'right-2'
      }`}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}

export function AdSlideshow({
  open,
  onOpenChange,
  feed,
  format,
  onFormatChange,
  index,
  onIndexChange,
  origin,
  onPost,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed: AdFeed;
  format: AdFormat;
  onFormatChange: (key: AdFormat['key']) => void;
  index: number;
  onIndexChange: (index: number) => void;
  origin: string;
  onPost: (ad: AdDraft) => void;
}) {
  const [playing, setPlaying] = useState(false);
  // Which way the stage travels, so each slide-in follows the user's intent:
  // next comes from the right, back comes from the left.
  const [direction, setDirection] = useState<1 | -1>(1);
  const count = feed.ads.length;

  const go = useCallback(
    (next: number, travel: 1 | -1 = 1) => {
      if (count === 0) return;
      setDirection(travel);
      onIndexChange(((next % count) + count) % count);
    },
    [count, onIndexChange],
  );

  // Autoplay, unless the visitor asked for reduced motion.
  useEffect(() => {
    if (!open) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPlaying(!reduce);
  }, [open]);

  useEffect(() => {
    if (!open || !playing || count <= 1) return;
    const timer = setInterval(() => go(index + 1), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [open, playing, count, index, go]);

  const ad = feed.ads[index] ?? feed.ads[0];
  if (!ad) return null;

  const order = adOrderAction({
    storeName: feed.storeName,
    storeSlug: feed.storeSlug,
    itemId: ad.itemId,
    itemName: ad.itemName,
    pricePesewas: ad.pricePesewas,
    compareAtPricePesewas: ad.compareAtPricePesewas,
    discountPercent: ad.discountPercent,
    contactPhone: feed.contactPhone,
    origin,
  });
  const imageName = `${ad.itemName}-ad-${format.key}.png`;
  const ratio = format.width / format.height;
  // Each slide is keyed by its ad, so every navigation remounts it and replays
  // this entry animation. The direction mirrors where the slide travelled from.
  const enter = `motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 ${
    direction === 1 ? 'motion-safe:slide-in-from-right-6' : 'motion-safe:slide-in-from-left-6'
  }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl gap-4 rounded-xl p-4 sm:p-5"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            go(index + 1, 1);
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            go(index - 1, -1);
          }
        }}
      >
        <DialogTitle className="sr-only">Ad slideshow</DialogTitle>
        <DialogDescription className="sr-only">
          Preview each of today&apos;s ads and tap the order button on the one you like.
        </DialogDescription>

        <div className="flex flex-wrap items-center gap-2 pr-9">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-caption font-semibold text-primary">
            {ad.angle}
          </span>
          <div className="ml-auto flex gap-1">
            {AD_FORMATS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => onFormatChange(entry.key)}
                aria-pressed={entry.key === format.key}
                className={
                  entry.key === format.key
                    ? 'rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-caption font-semibold text-primary'
                    : 'rounded-md border border-border px-2.5 py-1 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground'
                }
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex justify-center">
            <div className="relative" style={{ width: `min(100%, calc(58dvh * ${ratio}))` }}>
              <div key={ad.itemId} className={enter}>
                <AdArtwork
                  itemId={ad.itemId}
                  itemName={ad.itemName}
                  format={format}
                  orderHref={order.href}
                  orderLabel={order.label}
                  size="stage"
                  priority
                  className="rounded-xl"
                />
              </div>
              {count > 1 && (
                <>
                  <ArrowButton side="left" label="Previous ad" onClick={() => go(index - 1, -1)} />
                  <ArrowButton side="right" label="Next ad" onClick={() => go(index + 1, 1)} />
                </>
              )}
            </div>
          </div>
          {count > 1 && playing && (
            <div className="h-1 overflow-hidden rounded-full bg-border">
              <div
                key={`progress-${ad.itemId}`}
                className="animate-tilza-progress h-full w-full rounded-full bg-primary"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div key={ad.itemId} className={`min-w-0 ${enter}`}>
            <p className="truncate font-display text-h4 leading-tight">{ad.itemName}</p>
            <p className="font-mono text-caption text-muted-foreground">
              {formatGhs(ad.pricePesewas)}
              {count > 1 ? ` · ${index + 1} of ${count}` : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {count > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
                onClick={() => setPlaying((current) => !current)}
                className="size-9 rounded-md"
              >
                {playing ? (
                  <Pause aria-hidden className="size-4" />
                ) : (
                  <Play aria-hidden className="size-4" />
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => void downloadAdImage(adImagePath(ad.itemId, format.key), imageName)}
              className="h-9 rounded-md font-semibold"
            >
              <Download aria-hidden className="size-4" /> Image
            </Button>
            <Button
              type="button"
              onClick={() => onPost(ad)}
              className="h-9 rounded-md font-semibold"
            >
              <Send aria-hidden className="size-4" /> Post
            </Button>
          </div>
        </div>

        {count > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {feed.ads.map((entry, dotIndex) => (
              <button
                key={entry.itemId}
                type="button"
                aria-label={`Ad ${dotIndex + 1} of ${count}`}
                aria-current={dotIndex === index}
                onClick={() => go(dotIndex, dotIndex >= index ? 1 : -1)}
                className={`size-2 rounded-full transition-colors ${
                  dotIndex === index ? 'bg-primary' : 'bg-border hover:bg-muted-foreground'
                }`}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
