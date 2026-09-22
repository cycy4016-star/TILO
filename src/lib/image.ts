// Client-safe image helpers (safe to import from 'use client' components).
// Compresses a picked/captured photo before upload so the bytes stored in
// Postgres stay small — the server caps item/logo/avatar sizes.

/**
 * Downscales+recompresses an image to JPEG. The result is a Blob of mime
 * 'image/jpeg' and <= the given max dimension on its longest side. Falls back
 * to the original file when the browser cannot decode it (weird raw formats)
 * or it needs no recompression to stay under the cap.
 *
 * @param quality 0..1 JPEG encoder quality (default 0.82 — good balance).
 */
export async function compressImageFile(file: File, maxDim = 1280, quality = 0.82): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) return file;

  // Only worth touching a large enough file.
  if (file.size <= 400 * 1024 && file.type === 'image/jpeg') return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob && blob.size > 0 ? blob : file), 'image/jpeg', quality);
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = url;
  });
}

/** Object URL for a picked/captured file — revoke it when the preview is gone. */
export function createPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
