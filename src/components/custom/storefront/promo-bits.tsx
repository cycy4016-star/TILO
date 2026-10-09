// Small storefront client islands: a ticking promo countdown and share
// buttons that open the share sheet. Text updates only — no layout motion.
'use client';

import { Share2, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ShareSheet } from '@/components/custom/share-sheet';
import { Button } from '@/components/ui/button';
import { countdownParts, promoHeadline } from '@/lib/promotions';
import { promoShareMessage, shopShareMessage } from '@/lib/share';

/** "Ends in 2d 04:12:33", ticking every second. Static "Ended" past the line. */
export function CountdownText({ endsAt, prefix = 'Ends in' }: { endsAt: string; prefix?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = countdownParts(endsAt, now);
  if (!remaining) return <span>Ended</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Timer aria-hidden className="size-3.5" />
      {prefix} {remaining}
    </span>
  );
}

/** Flash-sale strip: the first timed live promo, with a live countdown. */
export function FlashStrip({
  pro,
  promo,
  storeUrl,
  storeName,
}: {
  pro: boolean;
  promo: {
    name: string;
    code: string | null;
    kind: 'PERCENT' | 'FIXED';
    value: number;
    endsAt: string | null;
  } | null;
  storeUrl: string;
  storeName: string;
}) {
  if (!promo || !promo.endsAt) return null;
  return (
    <div
      className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3.5 ${
        pro
          ? 'border border-destructive/30 bg-destructive/[0.06]'
          : 'border-2 border-red-600 bg-red-50 dark:bg-red-950'
      }`}
    >
      <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`rounded-full px-2.5 py-1 font-bold uppercase tracking-wider text-white ${
            pro ? 'bg-destructive text-caption' : 'bg-red-600 text-xs'
          }`}
        >
          Flash sale
        </span>
        <span className="truncate text-small font-semibold">
          {promo.name} · {promoHeadline(promo)}
          {promo.code ? ` · code ${promo.code}` : ''}
        </span>
      </p>
      <span className="inline-flex items-center gap-2 text-small font-semibold text-destructive">
        <CountdownText endsAt={promo.endsAt} />
        <PromoShareButton
          storeName={storeName}
          promoName={promo.name}
          headline={promoHeadline(promo)}
          storeUrl={storeUrl}
        />
      </span>
    </div>
  );
}

export function PromoShareButton({
  storeName,
  promoName,
  headline,
  storeUrl,
  className = '',
}: {
  storeName: string;
  promoName: string;
  headline: string;
  storeUrl: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`Share ${promoName}`}
        className={`h-9 rounded-md text-xs font-semibold ${className}`}
      >
        <Share2 aria-hidden className="size-3.5" /> Share sale
      </Button>
      <ShareSheet
        open={open}
        onOpenChange={setOpen}
        title={`Share “${promoName}”`}
        description="Send this sale anywhere — the link carries it."
        message={promoShareMessage({ storeName, promoName, headline, storeUrl })}
        url={storeUrl}
      />
    </>
  );
}

export function StoreShareButton({
  storeName,
  tagline,
  storeUrl,
  className = '',
}: {
  storeName: string;
  tagline: string | null;
  storeUrl: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`Share ${storeName}`}
        className={`h-10 rounded-md font-semibold ${className}`}
      >
        <Share2 aria-hidden className="size-4" /> Share shop
      </Button>
      <ShareSheet
        open={open}
        onOpenChange={setOpen}
        title={`Share “${storeName}”`}
        description="One link, every chat — WhatsApp carries the intro."
        message={shopShareMessage({ storeName, storeUrl, tagline })}
        url={storeUrl}
      />
    </>
  );
}
