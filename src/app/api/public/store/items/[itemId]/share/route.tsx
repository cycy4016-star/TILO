// Branded product share image: 1200×630 card with the shop name, product,
// price (plus sale badge), and store link — downloaded from the share sheet
// and pasted wherever the owner posts.
import { ImageResponse } from 'next/og';
import { brandVisual } from '@/lib/brand';
import { formatGhs } from '@/lib/contracts/order';
import { prisma } from '@/lib/db';
import { itemDiscountPercent } from '@/lib/promotions';

export const contentType = 'image/png';

type RouteContext = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { itemId } = await context.params;
    const item = await prisma.storeItem.findFirst({
      where: { id: itemId },
      include: { store: true },
    });
    if (!item) return new Response('Not found', { status: 404 });

    const discount = itemDiscountPercent({
      pricePesewas: item.pricePesewas,
      compareAtPricePesewas: item.compareAtPricePesewas,
    });

    const logoSrc =
      item.store.logo != null
        ? `data:${item.store.logoMime ?? 'image/jpeg'};base64,${Buffer.from(item.store.logo).toString('base64')}`
        : null;
    const storeUrl = `tilo.app/store/${item.store.slug}`;

    return new ImageResponse(
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '64px 72px',
          background: brandVisual.og.background,
          color: brandVisual.og.foreground,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {logoSrc ? (
            <img src={logoSrc} alt="" width={72} height={72} style={{ borderRadius: 18 }} />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: logoSrc ? 24 : 0 }}>
            <div style={{ display: 'flex', fontSize: 36, fontWeight: 700 }}>{item.store.name}</div>
            <div style={{ display: 'flex', fontSize: 24, opacity: 0.7 }}>{storeUrl}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 800 }}>{item.name}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 12 }}>
            <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, color: '#fbbf24' }}>
              {formatGhs(item.pricePesewas)}
            </div>
            {discount != null ? (
              <div style={{ display: 'flex', fontSize: 32, marginLeft: 20, opacity: 0.75 }}>
                {`was ${formatGhs(item.compareAtPricePesewas ?? 0)} (−${discount}%)`}
              </div>
            ) : null}
          </div>
        </div>
      </div>,
      { width: 1200, height: 630 },
    );
  } catch {
    return new Response('Internal Server Error', { status: 500 });
  }
}
