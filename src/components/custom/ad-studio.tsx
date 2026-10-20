// Ad Studio: today's ready-to-post ads, one per live listing. The feed is
// derived server-side and rotates once a day; this island picks a format,
// previews the generated artwork and hands a draft to the post sheet.
'use client';

import {
  Copy,
  Download,
  Layers,
  Megaphone,
  MonitorPlay,
  Send,
  Shuffle,
  Sparkles,
  Store,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdArtwork } from '@/components/custom/ad-artwork';
import { AdBulkPostSheet } from '@/components/custom/ad-bulk-post-sheet';
import { AdCarousel } from '@/components/custom/ad-carousel';
import { AdPostSheet, copyAdCaption, downloadAdImage } from '@/components/custom/ad-post-sheet';
import { AdSlideshow } from '@/components/custom/ad-slideshow';
import { Button } from '@/components/ui/button';
import {
  AD_FORMATS,
  type AdFormat,
  adImagePath,
  adOrderAction,
  buildCampaignCaption,
  CAROUSEL_MAX,
  carouselAdPath,
  storeOrderAction,
} from '@/lib/ads';
import { apiFetch } from '@/lib/api-client';
import { type AdDraft, AdFeed } from '@/lib/contracts/ads';
import { formatGhs } from '@/lib/contracts/order';
import { countdownParts } from '@/lib/promotions';

function nextUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function FreshnessNote({ dayKey }: { dayKey: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = now === null ? null : countdownParts(nextUtcMidnight().toISOString(), now);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-caption font-medium text-muted-foreground">
      <Sparkles aria-hidden className="size-3.5" />
      {remaining ? `Fresh set in ${remaining}` : `Today · ${dayKey}`}
    </span>
  );
}

export function AdStudio() {
  const [feed, setFeed] = useState<AdFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [format, setFormat] = useState<AdFormat['key']>('square');
  // Which angle-shuffle set is on screen. The server rebuilds deterministically
  // per (day, variant), so a shuffle is stable across reloads.
  const [variant, setVariant] = useState(0);
  const [posting, setPosting] = useState<AdDraft | null>(null);
  // Index into the feed when the slideshow is open; null keeps it closed.
  const [stageIndex, setStageIndex] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(false);

  const load = useCallback(async (target: number) => {
    setLoading(true);
    setError(false);
    try {
      setFeed(await apiFetch(`/api/ads?variant=${target}`, { schema: AdFeed }));
      setVariant(target);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(0);
  }, [load]);

  const activeFormat: AdFormat =
    AD_FORMATS.find((entry) => entry.key === format) ?? (AD_FORMATS[0] as AdFormat);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // The multi-product ad shows the first few listings for the active format.
  const carouselAds = feed ? feed.ads.slice(0, CAROUSEL_MAX[format]) : [];
  const carouselIds = carouselAds.map((ad) => ad.itemId);
  const storeOrder = feed
    ? storeOrderAction({
        storeName: feed.storeName,
        storeSlug: feed.storeSlug,
        contactPhone: feed.contactPhone,
        origin,
      })
    : null;
  const campaignCaption = feed
    ? buildCampaignCaption({
        storeName: feed.storeName,
        storeSlug: feed.storeSlug,
        origin,
        contactPhone: feed.contactPhone,
        items: carouselAds.map((ad) => ({
          itemId: ad.itemId,
          headline: ad.headline,
          pricePesewas: ad.pricePesewas,
          compareAtPricePesewas: ad.compareAtPricePesewas,
          discountPercent: ad.discountPercent,
          hashtags: ad.hashtags,
        })),
      })
    : '';

  return (
    <div className="grid gap-8">
      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded bg-highlight-wash px-2.5 py-1 text-caption font-bold text-highlight-ink">
            <Megaphone aria-hidden className="size-3.5" /> Ad Studio
          </span>
          {feed && <FreshnessNote dayKey={feed.dayKey} />}
        </div>
        <h1 className="mt-2 text-h2 font-display">
          Today&apos;s <span className="text-primary">ads.</span>
        </h1>
        <p className="mt-1.5 max-w-lg text-small text-muted-foreground">
          A fresh ad for every listing, written and designed for you. Pick a look, hit post, and
          choose where it goes — new angles arrive every night at midnight UTC.
        </p>
        {feed && feed.ads.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => setStageIndex(0)}
              className="rounded-md font-semibold"
            >
              <MonitorPlay aria-hidden className="size-4" /> Play today&apos;s ads
            </Button>
            {feed.ads.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setBulkOpen(true)}
                className="rounded-md font-semibold"
              >
                <Layers aria-hidden className="size-4" /> Post all at once
              </Button>
            ) : null}
            <span className="text-caption text-muted-foreground">
              {feed.ads.length} {feed.ads.length === 1 ? 'ad' : 'ads'} ready to post
            </span>
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-h4 font-display">Choose a format</h2>
          <p className="text-caption text-muted-foreground">
            Each ad is redrawn at the size you pick.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {AD_FORMATS.map((entry) => {
            const selected = entry.key === format;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setFormat(entry.key)}
                aria-pressed={selected}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-card hover:border-foreground/20'
                }`}
              >
                <span
                  className={`block text-small font-semibold ${
                    selected ? 'text-highlight-ink' : 'text-foreground'
                  }`}
                >
                  {entry.label}
                </span>
                <span className="mt-0.5 block text-caption text-muted-foreground">
                  {entry.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {!loading && !error && feed && feed.ads.length > 1 ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-h4 font-display">Multi-product ad</h2>
            <p className="text-caption text-muted-foreground">One post, several listings.</p>
          </div>
          <div className="grid gap-6 rounded-lg border border-border bg-card p-6 sm:p-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-center">
            <div className="mx-auto w-full max-w-xs">
              <AdCarousel
                slug={feed.storeSlug}
                itemIds={carouselIds}
                format={activeFormat}
                orderHref={storeOrder?.href ?? '#'}
                orderLabel={storeOrder?.label ?? 'Order'}
                size="stage"
                className="rounded-lg"
              />
            </div>
            <div className="grid gap-3">
              <p className="text-small text-muted-foreground">
                Bundle up to {CAROUSEL_MAX[format]} of your listings into a single image — ideal for
                a WhatsApp Status or a feed post that shows off your range.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => setShowcaseOpen(true)}
                  className="h-9 rounded-md font-semibold"
                >
                  <Send aria-hidden className="size-4" /> Post this ad
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void downloadAdImage(
                      carouselAdPath(feed.storeSlug, carouselIds, format),
                      `${feed.storeSlug}-showcase-${format}.png`,
                    )
                  }
                  className="h-9 rounded-md font-semibold"
                >
                  <Download aria-hidden className="size-4" /> Image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void copyAdCaption(campaignCaption).then(
                      () => toast.success('Caption copied'),
                      () => toast.error('Copy failed'),
                    );
                  }}
                  className="h-9 rounded-md font-semibold"
                >
                  <Copy aria-hidden className="size-4" /> Caption
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {['a', 'b', 'c'].map((key) => (
            <div key={key} className="h-96 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : error || !feed ? (
        <section className="grid gap-3 rounded-lg border border-border bg-muted/40 p-8 text-center">
          <p className="text-small font-medium text-destructive">
            We could not build your ads. Please try again.
          </p>
          <Button
            type="button"
            onClick={() => void load(variant)}
            className="h-9 justify-self-center rounded-md font-semibold"
          >
            Try again
          </Button>
        </section>
      ) : feed.ads.length === 0 ? (
        <section className="grid gap-3 rounded-lg border border-border bg-muted/40 p-8 text-center">
          <Store aria-hidden className="mx-auto size-10 text-muted-foreground" />
          <p className="text-h4 font-display">No listings to advertise yet</p>
          <p className="mx-auto max-w-sm text-small text-muted-foreground">
            Add products to your catalogue and an ad appears here for each one, refreshed every day.
          </p>
          <Button asChild className="justify-self-center rounded-md font-semibold">
            <Link href="/dashboard/store">Go to catalogue</Link>
          </Button>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {feed.ads.map((ad) => {
            const imageUrl = adImagePath(ad.itemId, format);
            const imageName = `${ad.itemName}-ad-${format}.png`;
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
            return (
              <article
                key={ad.itemId}
                className="lift group flex flex-col overflow-hidden rounded-lg border border-border bg-card"
              >
                <AdArtwork
                  itemId={ad.itemId}
                  itemName={ad.itemName}
                  format={activeFormat}
                  orderHref={order.href}
                  orderLabel={order.label}
                  size="card"
                />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-caption font-semibold text-highlight-ink">
                      {ad.angle}
                    </span>
                    <span className="font-mono text-caption font-bold text-primary">
                      {formatGhs(ad.pricePesewas)}
                    </span>
                    {ad.discountPercent != null ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-caption font-semibold text-destructive">
                        -{ad.discountPercent}%
                      </span>
                    ) : null}
                  </div>
                  <h3 className="font-display text-h4 leading-tight">{ad.itemName}</h3>
                  <p className="line-clamp-3 whitespace-pre-wrap text-caption leading-relaxed text-muted-foreground">
                    {ad.caption}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button
                      type="button"
                      onClick={() => setPosting(ad)}
                      className="h-9 rounded-md font-semibold"
                    >
                      <Send aria-hidden className="size-4" /> Post
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void downloadAdImage(imageUrl, imageName)}
                      className="h-9 rounded-md font-semibold"
                    >
                      <Download aria-hidden className="size-4" /> Image
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void copyAdCaption(ad.caption).then(
                          () => toast.success('Caption copied'),
                          () => toast.error('Copy failed'),
                        );
                      }}
                      className="h-9 rounded-md font-semibold"
                    >
                      <Copy aria-hidden className="size-4" /> Caption
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className="flex justify-center border-t border-border pt-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void load(variant + 1)}
          disabled={loading}
          className="h-8 rounded-md font-semibold text-muted-foreground hover:text-foreground"
        >
          <Shuffle aria-hidden className="size-3.5" /> Shuffle the angles
        </Button>
      </div>

      {posting && feed && (
        <AdPostSheet
          open={posting !== null}
          onOpenChange={(open) => {
            if (!open) setPosting(null);
          }}
          title={`Post “${posting.itemName}”`}
          description="Pick where this ad goes — the image and caption come with you."
          caption={posting.caption}
          url={`${origin}/store/${feed.storeSlug}#${posting.itemId}`}
          imageUrl={adImagePath(posting.itemId, format)}
          imageName={`${posting.itemName}-ad-${format}.png`}
          storeName={feed.storeName}
          storeSlug={feed.storeSlug}
          itemName={posting.itemName}
          imageAspect={`${activeFormat.width} / ${activeFormat.height}`}
        />
      )}

      {feed && feed.ads.length > 0 && (
        <AdSlideshow
          open={stageIndex !== null}
          onOpenChange={(open) => {
            if (!open) setStageIndex(null);
          }}
          feed={feed}
          format={activeFormat}
          onFormatChange={setFormat}
          index={stageIndex ?? 0}
          onIndexChange={setStageIndex}
          origin={origin}
          onPost={(ad) => {
            setStageIndex(null);
            setPosting(ad);
          }}
        />
      )}

      {showcaseOpen && feed && storeOrder && (
        <AdPostSheet
          open={showcaseOpen}
          onOpenChange={setShowcaseOpen}
          title="Post the multi-product ad"
          description="One image featuring several listings — great for a Status or feed post."
          caption={campaignCaption}
          url={`${origin}/store/${feed.storeSlug}`}
          imageUrl={carouselAdPath(feed.storeSlug, carouselIds, format)}
          imageName={`${feed.storeSlug}-showcase-${format}.png`}
          storeName={feed.storeName}
          storeSlug={feed.storeSlug}
          itemName={`${carouselAds.length} featured product${carouselAds.length === 1 ? '' : 's'}`}
          imageAspect={`${activeFormat.width} / ${activeFormat.height}`}
        />
      )}

      {feed && feed.ads.length > 1 && (
        <AdBulkPostSheet
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          feed={feed}
          format={activeFormat}
          origin={origin}
        />
      )}
    </div>
  );
}
