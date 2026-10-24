import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { z } from 'zod';
import { AD_CARD, AD_TEXT, adPalette, clampText, nameFontSize } from '@/lib/ad-visuals';
import { env } from '@/lib/env';
import { siteUrl } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Shop online on Tilza';

const brandLogoSrc = `data:image/png;base64,${readFileSync(
  path.join(process.cwd(), 'public', 'brand', 'tilza-logo.png'),
).toString('base64')}`;

const ShareStore = z.object({
  name: z.string(),
  slug: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
});

type ImageProps = { params: Promise<{ slug: string }> };

async function fetchStore(slug: string) {
  try {
    const res = await fetch(`${env.BETTER_AUTH_URL}/api/public/store/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const parsed = ShareStore.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function absoluteUrl(value: string): string {
  if (/^https?:\/\//.test(value)) return value;
  const base = env.BETTER_AUTH_URL.replace(/\/+$/, '');
  return `${base}${value.startsWith('/') ? '' : '/'}${value}`;
}

async function fetchLogo(value: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    const res = await fetch(absoluteUrl(value), { cache: 'no-store' });
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') ?? '';
    if (!mime.startsWith('image/')) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

export default async function StoreOpengraphImage({ params }: ImageProps) {
  const { slug } = await params;
  const store = await fetchStore(slug);

  const { accent, tint, accentText, pillText } = adPalette(null);
  const name = store?.name ?? 'Shop on Tilza';
  const tagline =
    store?.tagline ?? store?.description ?? 'Browse the catalogue and order on WhatsApp.';
  const logo = await fetchLogo(store?.logoUrl ?? null);
  const storeUrl = store
    ? `${siteUrl.replace(/^https?:\/\//, '')}/store/${store.slug}`
    : siteUrl.replace(/^https?:\/\//, '');

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: AD_CARD,
        color: AD_TEXT,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', height: 22, background: accent }} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'space-between',
          padding: '70px 80px 60px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {logo ? (
            <div
              style={{
                display: 'flex',
                width: 112,
                height: 112,
                borderRadius: 24,
                backgroundImage: `url(${logo})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundColor: '#ffffff',
                border: '2px solid rgba(10,10,10,0.08)',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 112,
                height: 112,
                borderRadius: 24,
                background: tint,
                color: accentText,
                fontSize: 64,
                fontWeight: 800,
              }}
            >
              {name.trim().charAt(0).toUpperCase() || 'S'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: accentText,
              }}
            >
              Open for orders
            </div>
            <div
              style={{
                display: 'flex',
                maxWidth: 840,
                fontSize: nameFontSize(name, 70),
                fontWeight: 800,
                lineHeight: 1.05,
                overflow: 'hidden',
              }}
            >
              {clampText(name, 48)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div
            style={{
              display: 'flex',
              maxWidth: 900,
              fontSize: 36,
              lineHeight: 1.25,
              color: 'rgba(10,10,10,0.66)',
            }}
          >
            {clampText(tagline, 140)}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 24,
            }}
          >
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
              Shop the catalogue
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 10,
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: next/og renders a canvas, not the DOM. */}
              <img src={brandLogoSrc} alt="Tilza" width={132} height={51} />
              <div style={{ display: 'flex', fontSize: 24, color: 'rgba(10,10,10,0.45)' }}>
                {storeUrl}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
