// Client-safe image helpers (safe to import from 'use client' components).
// Compresses a picked/captured photo before upload so the bytes stored in
// Postgres stay small — the server caps item/logo/avatar sizes.

export type ImageKind = 'item' | 'logo' | 'avatar' | 'promo' | 'banner';
/** Server ceilings, mirrored here so the picker can refuse early with a
 *  friendly message instead of a round trip. Keep in sync with
 *  src/lib/image-upload.ts MAX_BYTES. */
const MAX_BYTES: Record<ImageKind, number> = {
  item: 5 * 1024 * 1024,
  promo: 5 * 1024 * 1024,
  banner: 5 * 1024 * 1024,
  logo: 2 * 1024 * 1024,
  avatar: 2 * 1024 * 1024,
};

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Friendly pre-upload check: wrong type or over the server cap. Returns the
 * message to show, or null when the file is fine to compress and send.
 */
export function validateImageFile(file: File, kind: ImageKind): string | null {
  if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
    return 'That file is not a photo — pick a JPEG, PNG, WebP or GIF.';
  }
  const capMb = Math.round(MAX_BYTES[kind] / 1024 / 1024);
  if (file.size > MAX_BYTES[kind]) {
    return `That photo is too big (${(file.size / 1024 / 1024).toFixed(1)} MB) — pick one under ${capMb} MB.`;
  }
  return null;
}

/**
 * Downscales+recompresses an image to WebP (JPEG fallback where WebP encode
 * is unavailable). EXIF orientation is honoured, so phone photos never arrive
 * sideways; metadata is dropped with the re-encode. Falls back to the
 * original file when the browser cannot decode it or nothing is gained.
 *
 * @param quality 0..1 encoder quality (default 0.82 — good balance).
 */
export async function compressImageFile(file: File, maxDim = 1280, quality = 0.82): Promise<Blob> {
  if (!ALLOWED_TYPES.has(file.type.toLowerCase())) return file;

  // Only worth touching a large enough file.
  if (file.size <= 400 * 1024 && file.type === 'image/jpeg') return file;

  try {
    const bitmap = await decodeOriented(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === 'image/webp') return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    closeBitmap(bitmap);

    // Prefer WebP; older browsers fall back to JPEG (both on the allowlist).
    const webp = await encodeCanvas(canvas, 'image/webp', quality);
    if (webp && webp.size > 0 && webp.size < file.size) return webp;
    const jpeg = await encodeCanvas(canvas, 'image/jpeg', quality);
    if (jpeg && jpeg.size > 0 && jpeg.size < file.size) return jpeg;
    return file;
  } catch {
    return file;
  }
}

/**
 * Every slot on the storefront renders a fixed shape (banner cover, square
 * logo, 4:3 product photo…), so an upload of any aspect is center-cropped to
 * that shape and downscaled to the size below before it leaves the browser.
 * Result: photos always fill their frame — no letterboxing, no surprise crops
 * server-side, and smaller bytes in Postgres.
 */
export type ImageSlot = 'item' | 'logo' | 'avatar' | 'promo' | 'banner' | 'cover';

export const SLOT_SIZE: Record<ImageSlot, { width: number; height: number }> = {
  // Full-bleed cover on a max-w-5xl page (~1024px) at ~1.5x for retina.
  banner: { width: 1600, height: 640 },
  // Square mark overlapping the banner; shown at ~96px.
  logo: { width: 512, height: 512 },
  // Product card photo, rendered at aspect-[4/3].
  item: { width: 1200, height: 900 },
  // Promo artwork, rendered at aspect-[16/9].
  promo: { width: 1200, height: 675 },
  // Shelf thumb next to the shelf heading (~44px shown).
  cover: { width: 400, height: 400 },
  // Profile avatar.
  avatar: { width: 512, height: 512 },
};

/** One-line "what fits best" hint for picker helper text. */
export const SLOT_HINT: Record<ImageSlot, string> = {
  banner: 'Best: a wide landscape photo — any photo works, we auto-fit it to 1600×640.',
  logo: 'Best: a square logo or clear product shot — auto-fitted to a square.',
  item: 'Best: a landscape product photo — auto-fitted to 4:3.',
  promo: 'Best: a wide sale graphic — auto-fitted to 16:9.',
  cover: 'Best: a square shelf photo — auto-fitted to a square.',
  avatar: 'Best: a square headshot — auto-fitted to a square.',
};

/**
 * Largest centered source rect at the target aspect ratio (cover behavior).
 * Pure math — unit-tested in tests/unit/image-fit.test.ts.
 */
export function coverCropRect(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
): { x: number; y: number; w: number; h: number } {
  const targetAspect = targetW / targetH;
  const srcAspect = srcW / srcH;
  let w = srcW;
  let h = srcH;
  if (srcAspect > targetAspect) w = Math.round(srcH * targetAspect);
  else h = Math.round(srcW / targetAspect);
  return { x: Math.round((srcW - w) / 2), y: Math.round((srcH - h) / 2), w, h };
}

/**
 * Crop-to-slot + downscale + re-encode, like compressImageFile but with the
 * framing decided up front. Never upscales: a photo smaller than the slot
 * keeps its own pixels, just re-framed. Falls back to the original file when
 * the browser cannot decode it.
 *
 * @param quality 0..1 encoder quality (default 0.82 — good balance).
 */
export async function fitImageFile(file: File, slot: ImageSlot, quality = 0.82): Promise<Blob> {
  if (!ALLOWED_TYPES.has(file.type.toLowerCase())) return file;
  const spec = SLOT_SIZE[slot];
  try {
    const bitmap = await decodeOriented(file);
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    if (!srcW || !srcH) {
      closeBitmap(bitmap);
      return file;
    }
    // Cover-crop: largest centered rect at the slot's aspect ratio.
    const crop = coverCropRect(srcW, srcH, spec.width, spec.height);
    const { x: cropX, y: cropY, w: cropW, h: cropH } = crop;
    // Downscale to the slot, never upscale.
    const scale = Math.min(1, spec.width / cropW);
    const outW = Math.max(1, Math.round(cropW * scale));
    const outH = Math.max(1, Math.round(cropH * scale));
    const alreadyFits =
      scale === 1 &&
      cropW === srcW &&
      cropH === srcH &&
      (file.type === 'image/webp' || file.size <= 400 * 1024);
    if (alreadyFits) {
      closeBitmap(bitmap);
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      closeBitmap(bitmap);
      return file;
    }
    ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
    closeBitmap(bitmap);
    const webp = await encodeCanvas(canvas, 'image/webp', quality);
    if (webp && webp.size > 0 && webp.size < file.size) return webp;
    const jpeg = await encodeCanvas(canvas, 'image/jpeg', quality);
    if (jpeg && jpeg.size > 0 && jpeg.size < file.size) return jpeg;
    return file;
  } catch {
    return file;
  }
}

/** Decode with EXIF orientation applied; falls back to a plain <img>. */ async function decodeOriented(
  file: File,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // `imageOrientation` is typed in newer libs; probe at runtime instead.
      return await createImageBitmap(file, {
        imageOrientation: 'from-image',
      } as ImageBitmapOptions);
    } catch {
      // Fall through to <img> below.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Release an ImageBitmap without touching a plain <img>. */
function closeBitmap(bitmap: ImageBitmap | HTMLImageElement): void {
  const closable = bitmap as Partial<ImageBitmap>;
  if (typeof closable.close === 'function') closable.close();
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = url;
  });
}

/**
 * Tiny blurred placeholder (24px WebP data URL) for blur-up previews while
 * the full image compresses or loads. Null when the browser cannot oblige.
 */
export async function makeBlurPlaceholder(file: File): Promise<string | null> {
  try {
    const bitmap = await decodeOriented(file);
    const canvas = document.createElement('canvas');
    const width = 24;
    const scale = width / bitmap.width;
    canvas.width = width;
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    closeBitmap(bitmap);
    const blob = await encodeCanvas(canvas, 'image/webp', 0.5);
    if (!blob) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Object URL for a picked/captured file — revoke it when the preview is gone. */
export function createPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
