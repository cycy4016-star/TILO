// The company's own ad creatives, rendered on demand with next/og so the press
// kit (and any campaign page) can serve the artwork straight from the app —
// no object storage, no design handoff. The copy lives in src/lib/brand-ads.ts
// and matches the repo generator's template (scripts/ads/template.html).
//
// These are COMPANY ads, not merchant ads: the merchant-side artwork lives in
// src/app/api/public/store/items/[itemId]/ad. The promise here is the one the
// product keeps — Tilza writes the ad and the caption and prepares it for each
// channel; the merchant makes the final post.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { BRAND_ADS, type BrandAd } from '@/lib/brand-ads';
import { imageCacheHeaders } from '@/lib/image-response';
import { allow, ipOf } from '@/lib/rate-limit';

export const contentType = 'image/png';

type RouteContext = { params: Promise<{ variant: string }> };

// Bump when the campaign artwork changes so cached images are re-rendered.
const ARTWORK_VERSION = new Date('2026-10-24T00:00:00.000Z');

const CREAM = '#fffaf5';
const WASH = '#fff3e8';
const PEACH = '#ffe9d7';
const INK = '#171717';
const DIM = '#5f5f5f';
const PRIMARY = '#cf4a00';

function sampleImage(name: string): string | null {
  try {
    const bytes = readFileSync(path.join(process.cwd(), 'public', 'samples', name));
    return `data:image/jpeg;base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

function brandLogoData(): string | null {
  try {
    const bytes = readFileSync(path.join(process.cwd(), 'public', 'brand', 'tilza-logo.png'));
    return `data:image/png;base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

const BRAND_LOGO = brandLogoData();
const BRAND_LOGO_ASPECT = 1378 / 477;

function Logo({ size = 38 }: { size?: number }) {
  if (BRAND_LOGO) {
    return (
      // biome-ignore lint/performance/noImgElement: next/og renders a canvas, not the DOM.
      <img
        src={BRAND_LOGO}
        alt="Tilza"
        width={Math.round(size * BRAND_LOGO_ASPECT)}
        height={size}
      />
    );
  }
  return (
    <div style={{ display: 'flex', fontSize: size, fontWeight: 800, letterSpacing: -1.8 }}>
      <span>TILZA</span>
      <span style={{ color: PRIMARY }}>.</span>
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignSelf: 'flex-start',
        background: INK,
        color: '#ffffff',
        borderRadius: 8,
        padding: '10px 16px',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: 1.7,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

function Headline({ ad, size }: { ad: BrandAd; size: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {ad.headline.map((line, index) => {
        const last = index === ad.headline.length - 1;
        return (
          <div
            key={line}
            style={{
              display: 'flex',
              fontSize: size,
              lineHeight: 0.94,
              letterSpacing: -0.045 * size,
              fontWeight: 800,
              color: INK,
              borderBottom: last ? `8px solid rgba(207, 74, 0, 0.32)` : 'none',
              paddingBottom: last ? 4 : 0,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid #e2ddd8',
        background: 'rgba(255, 255, 255, 0.78)',
        borderRadius: 999,
        padding: '9px 15px',
        fontSize: 15,
        fontWeight: 700,
        color: '#4f4a46',
      }}
    >
      {children}
    </div>
  );
}

function ProductCard({ ad }: { ad: BrandAd }) {
  const photo = sampleImage(ad.photo);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 320,
        background: '#ffffff',
        border: '1px solid #e7e1da',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 24px 48px rgba(59, 38, 24, 0.14)',
      }}
    >
      {photo ? (
        // biome-ignore lint/performance/noImgElement: next/og renders a canvas, not the DOM.
        <img src={photo} alt="" width={320} height={230} style={{ objectFit: 'cover' }} />
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '14px 16px 18px' }}>
        <div style={{ display: 'flex', fontSize: 12, fontWeight: 600, color: '#77716c' }}>
          Tilza shop
        </div>
        <div style={{ display: 'flex', marginTop: 4, fontSize: 18, fontWeight: 700, color: INK }}>
          {ad.photoCaption}
        </div>
        <div
          style={{ display: 'flex', marginTop: 10, fontSize: 15, fontWeight: 700, color: PRIMARY }}
        >
          Ready to post
        </div>
      </div>
    </div>
  );
}

function PostSheet({ ad }: { ad: BrandAd }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 420,
        background: '#ffffff',
        border: '1px solid #e7e1da',
        borderRadius: 20,
        padding: 24,
        boxShadow: '0 24px 48px rgba(59, 38, 24, 0.12)',
      }}
    >
      <div style={{ display: 'flex', fontSize: 20, fontWeight: 800, color: INK }}>
        Ready to post
      </div>
      {ad.channels.map((channel) => (
        <div
          key={channel}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #eee9e3',
            marginTop: 10,
            paddingTop: 10,
            fontSize: 15,
            fontWeight: 700,
            color: INK,
          }}
        >
          <span>{channel}</span>
          <span style={{ display: 'flex', fontSize: 12, fontWeight: 600, color: '#77716c' }}>
            image + caption ready
          </span>
        </div>
      ))}
    </div>
  );
}

export async function GET(request: Request, context: RouteContext) {
  try {
    if (!allow(`${ipOf(request)}:brand-ad`, 120)) {
      return new Response('Too many requests', { status: 429, headers: { 'retry-after': '60' } });
    }
    const { variant } = await context.params;
    const ad = BRAND_ADS.find((item) => item.key === variant);
    if (!ad) return new Response('Not found', { status: 404 });

    const story = ad.format === 'story';
    const headlineSize = story ? 108 : 82;

    const text = (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          width: story ? '100%' : 560,
        }}
      >
        <Logo size={story ? 42 : 38} />
        <div style={{ display: 'flex', marginTop: story ? 48 : 26 }}>
          <Eyebrow>{ad.eyebrow}</Eyebrow>
        </div>
        <div style={{ display: 'flex', marginTop: story ? 34 : 24 }}>
          <Headline ad={ad} size={headlineSize} />
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: story ? 40 : 28,
            width: story ? 860 : 520,
            fontSize: story ? 30 : 25,
            lineHeight: 1.45,
            fontWeight: 500,
            color: DIM,
          }}
        >
          {ad.body}
        </div>
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            marginTop: story ? 44 : 30,
            background: PRIMARY,
            color: '#ffffff',
            borderRadius: 10,
            padding: '20px 30px',
            fontSize: story ? 28 : 26,
            fontWeight: 700,
          }}
        >
          {ad.cta}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 18,
            fontSize: story ? 22 : 18,
            fontWeight: 600,
            color: '#6b6b6b',
          }}
        >
          {ad.fine}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 22,
          }}
        >
          {ad.channels.map((channel) => (
            <Pill key={channel}>{channel}</Pill>
          ))}
        </div>
      </div>
    );

    const visual = (
      <div
        style={{
          display: 'flex',
          flexDirection: story ? 'row' : 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 24,
          flexGrow: 1,
        }}
      >
        <ProductCard ad={ad} />
        {ad.key === 'adstudio' || ad.key === 'story' ? <PostSheet ad={ad} /> : null}
      </div>
    );

    const canvas = story ? (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '84px 78px',
          background: `linear-gradient(150deg, ${CREAM} 0%, ${WASH} 52%, ${PEACH} 100%)`,
        }}
      >
        {text}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 22, marginTop: 40 }}>
          {visual}
        </div>
      </div>
    ) : (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          padding: '56px 60px',
          gap: 36,
          background: `linear-gradient(135deg, ${CREAM} 0%, ${WASH} 58%, ${PEACH} 100%)`,
        }}
      >
        {text}
        {visual}
      </div>
    );

    return new ImageResponse(canvas, {
      width: ad.width,
      height: ad.height,
      headers: imageCacheHeaders(ARTWORK_VERSION, 'public, max-age=3600'),
    });
  } catch {
    return new Response('Internal Server Error', { status: 500 });
  }
}
