export type ShopLookKey = 'sunrise' | 'market' | 'fresh' | 'midnight';

export type ShopLook = {
  key: ShopLookKey;
  label: string;
  blurb: string;
  from: string;
  to: string;
  ink: string;
  soft: string;
};

export const SHOP_LOOKS: readonly ShopLook[] = [
  {
    key: 'sunrise',
    label: 'Sunrise',
    blurb: 'Warm orange, market energy',
    from: '#fb7701',
    to: '#ffc46b',
    ink: '#2a1200',
    soft: '#fff3e8',
  },
  {
    key: 'market',
    label: 'Market',
    blurb: 'Bold red, big deal energy',
    from: '#b91c1c',
    to: '#fb7701',
    ink: '#ffffff',
    soft: '#fff1ee',
  },
  {
    key: 'fresh',
    label: 'Fresh',
    blurb: 'Clean green, everyday calm',
    from: '#0f766e',
    to: '#5eead4',
    ink: '#ffffff',
    soft: '#ecfdf5',
  },
  {
    key: 'midnight',
    label: 'Midnight',
    blurb: 'Deep navy, premium finish',
    from: '#111827',
    to: '#4f46e5',
    ink: '#ffffff',
    soft: '#eef2ff',
  },
];

export const DEFAULT_SHOP_LOOK: ShopLookKey = 'sunrise';

export function getShopLook(key: string | null | undefined): ShopLook {
  return SHOP_LOOKS.find((look) => look.key === key) ?? (SHOP_LOOKS[0] as ShopLook);
}

export function shopInitials(name: string): string {
  const clean = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);
  if (clean.length === 0) return 'T';
  if (clean.length === 1) return (clean[0] as string).charAt(0).toUpperCase();
  return `${(clean[0] as string).charAt(0)}${(clean[1] as string).charAt(0)}`.toUpperCase();
}

export function suggestShopNames(firstName: string | null | undefined): string[] {
  const first = firstName?.trim().split(/\s+/)[0];
  if (!first) return ['The Corner Shop', 'Market Finds', 'Little Studio', 'Everyday Goods'];
  return [`${first}'s Shop`, `${first}'s Corner`, `${first} Studio`, `${first} & Co.`];
}

export function shopPath(slug: string): string {
  return `/store/${slug.trim() || 'your-shop'}`;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  look: ShopLook,
): void {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, look.from);
  gradient.addColorStop(1, look.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawSparkles(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  for (let index = 0; index < 18; index += 1) {
    const x = ((index * 97) % Math.max(1, width - 40)) + 20;
    const y = ((index * 53) % Math.max(1, height - 40)) + 20;
    const radius = 2 + (index % 4) * 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  weight: number,
): number {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Inter, "Segoe UI", Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 4;
  } while (size > 20);
  return size;
}

async function fileFromCanvas(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const webp = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.9);
  });
  if (webp && webp.size > 0) {
    return new File([webp], `${name}.webp`, { type: 'image/webp' });
  }
  const png = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
  if (png && png.size > 0) {
    return new File([png], `${name}.png`, { type: 'image/png' });
  }
  throw new Error('Could not create the shop image');
}

export async function renderShopVisuals(
  lookKey: ShopLookKey,
  name: string,
  tagline: string,
): Promise<{ logo: File; banner: File }> {
  if (typeof document === 'undefined') {
    throw new Error('Shop visuals need a browser');
  }
  await document.fonts.ready.catch(() => undefined);

  const look = getShopLook(lookKey);
  const initial = shopInitials(name || 'Tilza');

  const logoCanvas = makeCanvas(512, 512);
  const logoCtx = logoCanvas.getContext('2d');
  if (!logoCtx) throw new Error('Could not create the shop logo');
  drawBackdrop(logoCtx, 512, 512, look);
  drawSparkles(logoCtx, 512, 512);
  logoCtx.save();
  logoCtx.globalAlpha = 0.16;
  logoCtx.strokeStyle = '#ffffff';
  logoCtx.lineWidth = 24;
  logoCtx.beginPath();
  logoCtx.arc(430, 82, 130, 0, Math.PI * 2);
  logoCtx.stroke();
  logoCtx.restore();
  logoCtx.fillStyle = look.ink;
  logoCtx.textAlign = 'center';
  logoCtx.textBaseline = 'middle';
  fitText(logoCtx, initial, 360, 260, 800);
  logoCtx.fillText(initial, 256, 272);

  const bannerCanvas = makeCanvas(1600, 800);
  const bannerCtx = bannerCanvas.getContext('2d');
  if (!bannerCtx) throw new Error('Could not create the shop banner');
  drawBackdrop(bannerCtx, 1600, 800, look);
  drawSparkles(bannerCtx, 1600, 800);

  bannerCtx.save();
  bannerCtx.globalAlpha = 0.12;
  bannerCtx.fillStyle = '#ffffff';
  bannerCtx.font = '800 620px Inter, "Segoe UI", Arial, sans-serif';
  bannerCtx.textAlign = 'right';
  bannerCtx.textBaseline = 'middle';
  bannerCtx.fillText(initial, 1500, 410);
  bannerCtx.restore();

  bannerCtx.save();
  bannerCtx.fillStyle = look.ink;
  bannerCtx.textAlign = 'left';
  bannerCtx.textBaseline = 'middle';
  const title = name.trim() || 'Your shop';
  fitText(bannerCtx, title, 1000, 116, 800);
  bannerCtx.fillText(title, 100, 340);
  if (tagline.trim()) {
    bannerCtx.globalAlpha = 0.78;
    fitText(bannerCtx, tagline.trim(), 880, 40, 600);
    bannerCtx.fillText(tagline.trim(), 104, 440);
  }
  bannerCtx.restore();

  return {
    logo: await fileFromCanvas(logoCanvas, 'tilza-shop-logo'),
    banner: await fileFromCanvas(bannerCanvas, 'tilza-shop-banner'),
  };
}
