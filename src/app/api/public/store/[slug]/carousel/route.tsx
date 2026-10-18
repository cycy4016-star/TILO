// Multi-product ad artwork: one image that shows several of a shop's live
// listings at once, painted in the shop's brand colour. Query picks the
// listings (?ids=a,b,c) and the shape (?format=square|story|wide); the order of
// `ids` is preserved so the owner can steer the layout. Like the single-item
// ad, this renders on demand with no object storage.
import { ImageResponse } from 'next/og';
import {
  AD_INK,
  AD_PANEL,
  AD_PAPER,
  AD_TILE,
  AD_TILE_FOOT,
  adPalette,
  clampText,
} from '@/lib/ad-visuals';
import { adFormat, CAROUSEL_MAX } from '@/lib/ads';
import { formatGhs } from '@/lib/contracts/order';
import { prisma } from '@/lib/db';
import { imageCacheHeaders, notModified } from '@/lib/image-response';
import { allow, ipOf } from '@/lib/rate-limit';

export const contentType = 'image/png';

// CPU-heavy render: cached but revalidated on every view (see the item ad
// route) so tiles refresh the moment a listing or the store changes.
const CACHE_CONTROL = 'public, max-age=0, must-revalidate';

type RouteContext = { params: Promise<{ slug: string }> };

type Layout = {
  pad: number;
  gap: number;
  cols: number;
  logo: number;
  title: number;
  eyebrow: number;
  url: number;
  nameSize: number;
  priceSize: number;
  tilePad: number;
};

// One deliberate composition per format: a brand header, a grid of product
// tiles that share the available height, and a shop-wide footer with the CTA.
const LAYOUT: Record<'square' | 'story' | 'wide', Layout> = {
  square: {
    pad: 52,
    gap: 22,
    cols: 2,
    logo: 64,
    title: 42,
    eyebrow: 22,
    url: 22,
    nameSize: 32,
    priceSize: 40,
    tilePad: 20,
  },
  story: {
    pad: 60,
    gap: 26,
    cols: 2,
    logo: 72,
    title: 48,
    eyebrow: 24,
    url: 24,
    nameSize: 36,
    priceSize: 46,
    tilePad: 24,
  },
  wide: {
    pad: 40,
    gap: 18,
    cols: 3,
    logo: 52,
    title: 32,
    eyebrow: 18,
    url: 18,
    nameSize: 26,
    priceSize: 30,
    tilePad: 14,
  },
};

function toDataUrl(bytes: Uint8Array, mime: string | null): string {
  return `data:${mime ?? 'image/jpeg'};base64,${Buffer.from(bytes).toString('base64')}`;
}

function chunk<T>(list: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    rows.push(list.slice(i, i + size));
  }
  return rows;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    if (!allow(`${ipOf(request)}:ad-carousel`, 120)) {
      return new Response('Too many requests', { status: 429, headers: { 'retry-after': '60' } });
    }
    const { slug } = await context.params;
    const params = new URL(request.url).searchParams;
    const format = adFormat(params.get('format'));
    // The Ad Studio overlays its own live CTA on the preview, so it can ask for
    // the artwork without the baked-in button (?cta=0).
    const showCta = params.get('cta') !== '0';

    const store = await prisma.store.findFirst({
      where: { slug, active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        theme: true,
        contactPhone: true,
        logo: true,
        logoMime: true,
        updatedAt: true,
      },
    });
    if (!store) return new Response('Not found', { status: 404 });

    const requestedIds = (params.get('ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, CAROUSEL_MAX[format.key]);
    if (requestedIds.length === 0) return new Response('Not found', { status: 404 });

    const rows = await prisma.storeItem.findMany({
      where: { id: { in: requestedIds }, storeId: store.id, active: true },
      select: {
        id: true,
        name: true,
        pricePesewas: true,
        image: true,
        imageMime: true,
        updatedAt: true,
      },
    });
    // Preserve the caller's ordering (the query order is unspecified).
    const byId = new Map(rows.map((item) => [item.id, item]));
    const items = requestedIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
    if (items.length === 0) return new Response('Not found', { status: 404 });

    // The canvas paints the store (name, logo, theme, phone) and the tiles, so
    // the newest of those timestamps is the strong validator.
    const updatedAt = new Date(
      Math.max(store.updatedAt.getTime(), ...items.map((item) => item.updatedAt.getTime())),
    );
    const notModifiedResponse = notModified(request, updatedAt, CACHE_CONTROL);
    if (notModifiedResponse) return notModifiedResponse;

    const { accent, accentText, pillText } = adPalette(store.theme);
    const { pad, gap, cols, nameSize, priceSize, tilePad } = LAYOUT[format.key];
    const logoSrc = store.logo != null ? toDataUrl(store.logo, store.logoMime) : null;
    const cta = store.contactPhone ? 'Order on WhatsApp' : 'Order from our shop';
    const tileRows = chunk(items, cols);

    const tile = (item: (typeof items)[number]) => {
      const photoSrc = item.image != null ? toDataUrl(item.image, item.imageMime) : null;
      return (
        <div
          key={item.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            flexBasis: 0,
            minWidth: 0,
            overflow: 'hidden',
            borderRadius: 24,
            background: AD_TILE,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexGrow: 1,
              minHeight: 0,
              overflow: 'hidden',
              backgroundImage: `linear-gradient(140deg, ${accent} 0%, ${AD_INK} 70%)`,
            }}
          >
            {photoSrc ? (
              <>
                {/* Autofit: dimmed full-bleed copy behind, uncropped photo in
                    front — any upload shape fills the tile cleanly. */}
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
                  fontSize: 96,
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.92)',
                }}
              >
                {item.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: tilePad,
              background: AD_TILE_FOOT,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: nameSize,
                fontWeight: 700,
                lineHeight: 1.12,
                color: AD_PAPER,
                overflow: 'hidden',
              }}
            >
              {clampText(item.name, 24)}
            </div>
            <div
              style={{ display: 'flex', fontSize: priceSize, fontWeight: 800, color: accentText }}
            >
              {formatGhs(item.pricePesewas)}
            </div>
          </div>
        </div>
      );
    };

    const canvas = (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: pad,
          gap,
          background: AD_PANEL,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {logoSrc ? (
            // biome-ignore lint/performance/noImgElement: next/og renders a canvas, not the DOM.
            <img
              src={logoSrc}
              alt=""
              width={LAYOUT[format.key].logo}
              height={LAYOUT[format.key].logo}
              style={{ borderRadius: 16, objectFit: 'contain', background: '#ffffff' }}
            />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                display: 'flex',
                fontSize: LAYOUT[format.key].title,
                fontWeight: 800,
                color: AD_PAPER,
                overflow: 'hidden',
              }}
            >
              {clampText(store.name, 34)}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: LAYOUT[format.key].eyebrow,
                fontWeight: 700,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: 'rgba(248,250,252,0.55)',
              }}
            >
              Shop the collection
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap }}>
          {tileRows.map((rowItems) => {
            const rowKey = rowItems[0]?.id ?? 'row';
            const missing = cols - rowItems.length;
            return (
              <div key={rowKey} style={{ display: 'flex', flexGrow: 1, gap }}>
                {rowItems.map(tile)}
                {missing > 0 ? (
                  <div
                    key={`${rowKey}-fill`}
                    style={{ display: 'flex', flexGrow: missing, flexBasis: 0 }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {showCta ? (
            <div
              style={{
                display: 'flex',
                background: accent,
                color: pillText,
                fontSize: priceSize - 6,
                fontWeight: 700,
                padding: '14px 32px',
                borderRadius: 999,
              }}
            >
              {cta}
            </div>
          ) : (
            <div style={{ display: 'flex' }} />
          )}
          <div
            style={{
              display: 'flex',
              fontSize: LAYOUT[format.key].url,
              color: 'rgba(248,250,252,0.5)',
            }}
          >
            {`${items.length} featured today`}
          </div>
        </div>
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
