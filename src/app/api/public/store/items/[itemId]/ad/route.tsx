// Generated ad artwork for one listing: a photo-first card carrying the shop's
// logo and name, the item, its price (with a sale badge) and a call to action,
// painted in Tilza's own blue and orange. Rendered on demand in three formats
// so the Ad Studio can show and download a ready-to-post image with no object
// storage. Mirrors the product share card, but bigger and format-aware.
//
// The card is WHITE, matching the storefront it advertises — blue carries the
// CTA, orange carries the price. Layout is one deliberate composition per
// format: the photo fills the top (or the left, in wide), the brand sits on a
// chip over the photo, and a bottom-anchored panel carries the category, name,
// price and CTA. Both accent colours are pinned literals whose contrast against
// white is fixed at authoring time, so no runtime luminance check is needed.
import { ImageResponse } from 'next/og';
import {
  AD_CARD,
  AD_TEXT,
  AD_TEXT_DIM,
  adPalette,
  clampText,
  nameFontSize,
} from '@/lib/ad-visuals';
import { adFormat } from '@/lib/ads';
import { formatGhs } from '@/lib/contracts/order';
import { prisma } from '@/lib/db';
import { imageCacheHeaders, notModified } from '@/lib/image-response';
import { itemDiscountPercent } from '@/lib/promotions';
import { allow, ipOf } from '@/lib/rate-limit';

export const contentType = 'image/png';

type RouteContext = { params: Promise<{ itemId: string }> };

// Rendering is CPU-heavy, so the URL is cached but revalidated on every view:
// the ETag (item + store + category updatedAt) turns repeat views into cheap
// 304s while an edit is visible on the very next load.
const CACHE_CONTROL = 'public, max-age=0, must-revalidate';

function toDataUrl(bytes: Uint8Array, mime: string | null): string {
  return `data:${mime ?? 'image/jpeg'};base64,${Buffer.from(bytes).toString('base64')}`;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    if (!allow(`${ipOf(request)}:ad-art`, 120)) {
      return new Response('Too many requests', { status: 429, headers: { 'retry-after': '60' } });
    }
    const { itemId } = await context.params;
    const params = new URL(request.url).searchParams;
    const format = adFormat(params.get('format'));
    // The Ad Studio overlays its own live CTA on the preview, so it can ask for
    // the artwork without the baked-in button (?cta=0). Downloads and the
    // published image keep the button drawn in.
    const showCta = params.get('cta') !== '0';
    const item = await prisma.storeItem.findFirst({
      where: { id: itemId },
      include: { store: true, category: true },
    });
    if (!item) return new Response('Not found', { status: 404 });

    // Everything painted here (item, its shelf heading, the store's name,
    // logo, theme and phone) is covered by these three timestamps.
    const updatedAt = new Date(
      Math.max(
        item.updatedAt.getTime(),
        item.store.updatedAt.getTime(),
        item.category?.updatedAt.getTime() ?? 0,
      ),
    );
    const notModifiedResponse = notModified(request, updatedAt, CACHE_CONTROL);
    if (notModifiedResponse) return notModifiedResponse;

    const discount = itemDiscountPercent(item);
    // Saturated accents read well on the dark card; the dark ones (slate, ocean,
    // violet) swap to their pale tint for the price so it never disappears.
    const { accent, tint, accentText, pillText } = adPalette(item.store.theme);
    const photoSrc = item.image != null ? toDataUrl(item.image, item.imageMime) : null;
    const logoSrc =
      item.store.logo != null ? toDataUrl(item.store.logo, item.store.logoMime) : null;
    const cta = item.store.contactPhone ? 'Order on WhatsApp' : 'Order from our shop';
    const wide = format.key === 'wide';
    const story = format.key === 'story';
    const pad = wide ? 68 : story ? 76 : 60;

    const brandChip = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'absolute',
          top: 44,
          left: 44,
          // Leaves room for the discount ribbon on the right, even in wide.
          maxWidth: '58%',
          background: 'rgba(15,23,42,0.62)',
          padding: '12px 22px 12px 14px',
          borderRadius: 999,
        }}
      >
        {logoSrc ? (
          // biome-ignore lint/performance/noImgElement: next/og renders a canvas, not the DOM.
          <img
            src={logoSrc}
            alt=""
            width={52}
            height={52}
            style={{ borderRadius: 14, objectFit: 'contain', background: '#ffffff' }}
          />
        ) : null}
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            fontWeight: 700,
            color: AD_TEXT,
            overflow: 'hidden',
          }}
        >
          {clampText(item.store.name, 26)}
        </div>
      </div>
    );

    const discountRibbon =
      discount != null ? (
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 44,
            right: 44,
            background: '#dc2626',
            color: '#ffffff',
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 1,
            padding: '10px 24px',
            borderRadius: 999,
          }}
        >
          {`-${discount}%`}
        </div>
      ) : null;

    const photo = (height: number | string, width: number | string) => (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          width,
          height,
          // Flat pale blue behind the photo. This used to be a 140° gradient
          // from the accent into the old navy ink; on a white ad a wash would
          // just tint the product, so the placeholder is a plain quiet field.
          background: tint,
        }}
      >
        {photoSrc ? (
          <>
            {/* Autofit: the photo itself is never cropped. A dimmed full-bleed
                copy fills the frame behind it, so any upload shape â€” portrait,
                square, panorama â€” reads as intentional with no adjusting. */}
            {/* biome-ignore lint/performance/noImgElement: next/og renders a canvas, not the DOM. */}
            <img
              src={photoSrc}
              alt=""
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.3,
              }}
            />
            {/* biome-ignore lint/performance/noImgElement: next/og renders a canvas, not the DOM. */}
            <img
              src={photoSrc}
              alt=""
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              fontSize: 160,
              fontWeight: 800,
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            {item.name.charAt(0).toUpperCase()}
          </div>
        )}
        {brandChip}
        {discountRibbon}
      </div>
    );

    const info = (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          gap: 16,
          flexGrow: 1,
          padding: pad,
        }}
      >
        {item.category?.name ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                width: 30,
                height: 6,
                borderRadius: 999,
                background: accent,
              }}
            />
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: 'rgba(248,250,252,0.62)',
              }}
            >
              {clampText(item.category.name, 24)}
            </div>
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            fontSize: nameFontSize(item.name, wide ? 58 : story ? 76 : 66),
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -0.5,
            color: AD_TEXT,
          }}
        >
          {clampText(item.name, 64)}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              fontSize: wide ? 52 : 60,
              fontWeight: 800,
              color: accentText,
            }}
          >
            {formatGhs(item.pricePesewas)}
          </div>
          {discount != null && item.compareAtPricePesewas != null ? (
            <div
              style={{
                display: 'flex',
                fontSize: 30,
                color: AD_TEXT_DIM,
                textDecoration: 'line-through',
              }}
            >
              {formatGhs(item.compareAtPricePesewas)}
            </div>
          ) : null}
        </div>
        {showCta ? (
          <div style={{ display: 'flex', marginTop: 6 }}>
            <div
              style={{
                display: 'flex',
                background: accent,
                color: pillText,
                fontSize: 28,
                fontWeight: 700,
                padding: '16px 34px',
                borderRadius: 999,
              }}
            >
              {cta}
            </div>
          </div>
        ) : null}
      </div>
    );

    const canvas = wide ? (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          background: AD_CARD,
        }}
      >
        {photo('100%', '52%')}
        {info}
      </div>
    ) : (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: AD_CARD,
        }}
      >
        {photo(story ? 1060 : 580, '100%')}
        {info}
      </div>
    );

    return new ImageResponse(canvas, {
      width: format.width,
      height: format.height,
      headers: imageCacheHeaders(updatedAt, CACHE_CONTROL),
    });
  } catch {
    return new Response('Internal Server Error', { status: 500 });
  }
}
