// "Post everything at once": choose any subset of today's ads, then send them
// out together. Compose channels open once with a single combined campaign
// caption; image-first channels save every selected image and copy that caption
// for the app. Posting one ad at a time (AdPostSheet) stays available.
'use client';

import { Check, Copy, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CHANNEL_ICONS, copyAdCaption, downloadAdImage } from '@/components/custom/ad-post-sheet';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AD_CHANNELS,
  type AdChannel,
  type AdFormat,
  adImagePath,
  adPostPlan,
  buildCampaignCaption,
} from '@/lib/ads';
import type { AdFeed } from '@/lib/contracts/ads';
import { formatGhs } from '@/lib/contracts/order';

function campaignCaption(feed: AdFeed, itemIds: string[], origin: string): string {
  const items = feed.ads
    .filter((ad) => itemIds.includes(ad.itemId))
    .map((ad) => ({
      itemId: ad.itemId,
      headline: ad.headline,
      pricePesewas: ad.pricePesewas,
      compareAtPricePesewas: ad.compareAtPricePesewas,
      discountPercent: ad.discountPercent,
      hashtags: ad.hashtags,
    }));
  return buildCampaignCaption({
    storeName: feed.storeName,
    storeSlug: feed.storeSlug,
    origin,
    contactPhone: feed.contactPhone,
    items,
  });
}

export function AdBulkPostSheet({
  open,
  onOpenChange,
  feed,
  format,
  origin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed: AdFeed;
  format: AdFormat;
  origin: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<AdChannel | 'save' | null>(null);

  useEffect(() => {
    if (open) setSelected(feed.ads.map((ad) => ad.itemId));
  }, [open, feed.ads]);

  const selectedSet = new Set(selected);
  const chosen = feed.ads.filter((ad) => selectedSet.has(ad.itemId));
  const caption = campaignCaption(feed, selected, origin);

  function toggle(itemId: string) {
    setSelected((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  async function select(channel: AdChannel) {
    if (chosen.length === 0) {
      toast.error('Pick at least one ad to post');
      return;
    }
    const plan = adPostPlan(channel, caption);
    setBusy(channel);
    try {
      if (plan.saveImage) {
        for (const ad of chosen) {
          await downloadAdImage(
            adImagePath(ad.itemId, format.key),
            `${ad.itemName}-ad-${format.key}.png`,
          );
        }
      }
      if (plan.copyCaption) {
        try {
          await copyAdCaption(caption);
        } catch {
          // Clipboard blocked — the note still tells them to paste by hand.
        }
      }
      if (plan.href) {
        const opened = window.open(plan.href, '_blank', 'noopener,noreferrer');
        if (!opened) window.location.href = plan.href;
      }
      toast.success(plan.note);
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  }

  async function saveAll() {
    if (chosen.length === 0) {
      toast.error('Pick at least one ad to save');
      return;
    }
    setBusy('save');
    try {
      for (const ad of chosen) {
        await downloadAdImage(
          adImagePath(ad.itemId, format.key),
          `${ad.itemName}-ad-${format.key}.png`,
        );
      }
      toast.success(`${chosen.length} images saved`);
    } finally {
      setBusy(null);
    }
  }

  async function copyCaption() {
    try {
      await copyAdCaption(caption);
      toast.success('Campaign caption copied — paste it anywhere');
    } catch {
      toast.error('Copy failed — select the caption and copy it yourself');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3">Post everything</DialogTitle>
          <DialogDescription>
            Send several of today&apos;s ads together as one campaign post.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <p className="text-small font-semibold">
            {chosen.length} of {feed.ads.length} selected
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-md font-semibold"
            onClick={() =>
              setSelected(chosen.length === feed.ads.length ? [] : feed.ads.map((ad) => ad.itemId))
            }
          >
            {chosen.length === feed.ads.length ? 'Clear all' : 'Select all'}
          </Button>
        </div>

        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-1">
          {feed.ads.map((ad) => {
            const isSelected = selectedSet.has(ad.itemId);
            return (
              <button
                key={ad.itemId}
                type="button"
                onClick={() => toggle(ad.itemId)}
                aria-pressed={isSelected}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border'
                  }`}
                >
                  {isSelected ? <Check aria-hidden className="size-3.5" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-small font-semibold">
                  {ad.itemName}
                </span>
                <span className="shrink-0 text-caption text-muted-foreground">
                  {formatGhs(ad.pricePesewas)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {AD_CHANNELS.map((channel) => {
            const Icon = CHANNEL_ICONS[channel.key];
            return (
              <Button
                key={channel.key}
                type="button"
                variant="outline"
                onClick={() => void select(channel.key)}
                disabled={busy !== null}
                className="h-11 justify-start gap-2 rounded-md font-semibold"
              >
                <Icon aria-hidden className="size-4" />
                {channel.label}
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void saveAll()}
            disabled={busy !== null}
            className="h-10 rounded-md font-semibold"
          >
            <Download aria-hidden className="size-4" /> Save all images
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void copyCaption()}
            className="h-10 rounded-md font-semibold"
          >
            <Copy aria-hidden className="size-4" /> Copy caption
          </Button>
        </div>

        <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/40 p-3">
          <p className="whitespace-pre-wrap text-caption text-muted-foreground">{caption}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
