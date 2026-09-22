// Server-side validation for uploaded images (store item photos, store logo,
// profile avatar). Images are stored as raw bytes in Postgres — no object
// storage — so they survive Render's ephemeral disk without extra setup.
// Client components pre-compress to keep payloads small; the limits below are
// the hard server-side ceiling.
import 'server-only';

// MIME types we accept (and serve back verbatim).
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type ImagePurpose = 'item' | 'logo' | 'avatar' | 'promo';

const MAX_BYTES: Record<ImagePurpose, number> = {
  item: 5 * 1024 * 1024, // 5 MB — matches the ~1280px client cap with headroom
  logo: 2 * 1024 * 1024, // 2 MB
  avatar: 2 * 1024 * 1024, // 2 MB
  promo: 5 * 1024 * 1024, // 5 MB — wide promo banner artwork
};

export type ReadImageResult =
  | { ok: true; bytes: Uint8Array; mime: string }
  | { ok: false; error: string };

export async function readImageUpload(
  form: FormData,
  purpose: ImagePurpose,
): Promise<ReadImageResult> {
  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'No image file was attached.' };
  const mime = file.type.toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, error: 'Only JPEG, PNG, WebP or GIF images are supported.' };
  }
  if (file.size > MAX_BYTES[purpose]) {
    return {
      ok: false,
      error: `Image too large (max ${Math.round(MAX_BYTES[purpose] / 1024 / 1024)} MB after compression).`,
    };
  }
  return { ok: true, bytes: new Uint8Array(await file.arrayBuffer()), mime };
}
