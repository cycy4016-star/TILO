'use client';

import { BadgeCheck, MessageCircle, Package, Share2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { getShopLook, type ShopLookKey, shopInitials, shopPath } from '@/lib/shop-brand';

type ShopPreviewProps = {
  name: string;
  tagline: string;
  slug: string;
  phone: string;
  lookKey: ShopLookKey;
  logoSrc: string | null;
  bannerSrc: string | null;
  socialCount: number;
  className?: string;
};

export function ShopPreview({
  name,
  tagline,
  slug,
  phone,
  lookKey,
  logoSrc,
  bannerSrc,
  socialCount,
  className,
}: ShopPreviewProps) {
  const look = getShopLook(lookKey);
  const displayName = name.trim() || 'Your shop';
  const initial = shopInitials(displayName);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-caption font-bold uppercase tracking-[0.08em] text-highlight-ink">
          <Sparkles aria-hidden className="size-3.5" /> Live preview
        </p>
        <p className="text-caption text-muted-foreground">Updates as you tap</p>
      </div>

      <div className="overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-xl">
        <div className="relative aspect-[16/8] overflow-hidden">
          {bannerSrc ? (
            <Image
              src={bannerSrc}
              alt=""
              width={640}
              height={320}
              unoptimized
              loading="eager"
              className="size-full object-cover"
            />
          ) : (
            <div
              className="relative size-full"
              style={{ background: `linear-gradient(135deg, ${look.from}, ${look.to})` }}
            >
              <span
                aria-hidden
                className="absolute -right-8 -top-12 size-40 rounded-full border-[18px] border-white/15"
              />
              <span
                aria-hidden
                className="absolute bottom-3 right-[28%] size-16 rounded-full bg-white/10"
              />
              <span className="absolute bottom-4 left-4 font-display text-6xl font-extrabold text-white/15">
                {initial}
              </span>
            </div>
          )}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-caption font-bold text-highlight-ink shadow-sm">
            <BadgeCheck aria-hidden className="size-3.5" /> Open for orders
          </span>
        </div>

        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="relative z-10 -mt-8 flex items-end gap-3">
            {logoSrc ? (
              <span className="size-16 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-white shadow-sm">
                <Image
                  src={logoSrc}
                  alt=""
                  width={128}
                  height={128}
                  unoptimized
                  className="size-full object-cover"
                />
              </span>
            ) : (
              <span
                className="grid size-16 shrink-0 place-items-center rounded-2xl border-4 border-card font-display text-h3 font-extrabold shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${look.from}, ${look.to})`,
                  color: look.ink,
                }}
              >
                {initial}
              </span>
            )}
            <div className="min-w-0 rounded-xl bg-card/95 px-2.5 py-1 shadow-xs">
              <p className="truncate font-display text-h3">{displayName}</p>
              <p className="truncate text-caption font-medium text-muted-foreground">
                {shopPath(slug)}
              </p>
            </div>
          </div>

          <p className="mt-3 line-clamp-2 min-h-10 text-small text-muted-foreground">
            {tagline.trim() || 'Your tagline will sit right here, under your shop name.'}
          </p>

          <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-caption text-muted-foreground">
              {shopPath(slug)}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-2 py-1 text-caption font-semibold text-primary shadow-xs">
              <Share2 aria-hidden className="size-3" /> Share
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="grid min-h-20 place-items-center rounded-xl border border-dashed border-border bg-muted/40 p-3 text-center">
              <Package aria-hidden className="size-5 text-primary" />
              <p className="mt-1 text-caption font-semibold text-muted-foreground">
                Your first item
              </p>
            </div>
            <div className="grid min-h-20 place-items-center rounded-xl border border-dashed border-border bg-muted/40 p-3 text-center">
              <Sparkles aria-hidden className="size-5 text-primary" />
              <p className="mt-1 text-caption font-semibold text-muted-foreground">New arrivals</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
            {phone.trim() ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <MessageCircle aria-hidden className="size-3.5 text-primary" /> Orders open in
                WhatsApp
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle aria-hidden className="size-3.5" /> Add your order number
              </span>
            )}
            {socialCount > 0 && (
              <span className="rounded-full bg-highlight-wash px-2 py-0.5 font-semibold text-highlight-ink">
                {socialCount} {socialCount === 1 ? 'social' : 'socials'} connected
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShopPreviewChip({
  name,
  slug,
  lookKey,
  logoSrc,
  className,
}: Pick<ShopPreviewProps, 'name' | 'slug' | 'lookKey' | 'logoSrc' | 'className'>) {
  const look = getShopLook(lookKey);
  const displayName = name.trim() || 'Your shop';
  const initial = shopInitials(displayName);

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm ${className ?? ''}`}
    >
      {logoSrc ? (
        <span className="size-11 shrink-0 overflow-hidden rounded-xl bg-white">
          <Image
            src={logoSrc}
            alt=""
            width={64}
            height={64}
            unoptimized
            className="size-full object-cover"
          />
        </span>
      ) : (
        <span
          className="grid size-11 shrink-0 place-items-center rounded-xl font-display text-h4 font-extrabold"
          style={{
            background: `linear-gradient(135deg, ${look.from}, ${look.to})`,
            color: look.ink,
          }}
        >
          {initial}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-small font-bold">{displayName}</p>
        <p className="truncate font-mono text-caption text-muted-foreground">{shopPath(slug)}</p>
      </div>
      <span className="shrink-0 rounded-full bg-highlight-wash px-2 py-1 text-caption font-bold text-highlight-ink">
        Preview
      </span>
    </div>
  );
}
