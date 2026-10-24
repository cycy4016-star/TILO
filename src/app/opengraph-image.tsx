// Dynamic social-share image for the marketing home: brand colours, logo and
// tagline, rendered at the standard 1200×630.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { brandVisual } from '@/lib/brand';
import { siteDescription } from '@/lib/site';

const brandLogoSrc = `data:image/png;base64,${readFileSync(
  path.join(process.cwd(), 'public', 'brand', 'tilza-logo.png'),
).toString('base64')}`;

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '96px',
        background: brandVisual.og.background,
        color: brandVisual.og.foreground,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: next/og renders a canvas, not the DOM. */}
      <img src={brandLogoSrc} alt="Tilza" width={260} height={90} />
      <div style={{ display: 'flex', marginTop: 28, fontSize: 40, opacity: 0.85 }}>
        {brandVisual.og.tagline}
      </div>
      <div style={{ display: 'flex', marginTop: 16, fontSize: 28, opacity: 0.6 }}>
        {`${siteDescription.slice(0, 110)}…`}
      </div>
    </div>,
    { ...size },
  );
}
