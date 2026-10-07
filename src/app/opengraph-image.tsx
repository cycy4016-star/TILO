// Dynamic social-share image for the marketing home: brand colours, site
// name and tagline, rendered at the standard 1200×630.
import { ImageResponse } from 'next/og';
import { brandVisual } from '@/lib/brand';
import { siteDescription, siteName } from '@/lib/site';

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
      <div style={{ display: 'flex', fontSize: 88, fontWeight: 800 }}>{siteName}</div>
      <div style={{ display: 'flex', marginTop: 24, fontSize: 40, opacity: 0.85 }}>
        {brandVisual.og.tagline}
      </div>
      <div style={{ display: 'flex', marginTop: 16, fontSize: 28, opacity: 0.6 }}>
        {`${siteDescription.slice(0, 110)}…`}
      </div>
    </div>,
    { ...size },
  );
}
