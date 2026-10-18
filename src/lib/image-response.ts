// Conditional GET support for the public image routes. The storefront already
// cache-busts image URLs with `?t=<updatedAt>`, so the row's updatedAt doubles
// as a strong ETag: a browser that already holds the current photo gets a 304
// and zero bytes instead of re-downloading it on every page view.
export function imageEtag(updatedAt: Date): string {
  return `"${updatedAt.getTime()}"`;
}

export function isFreshImage(request: Request, updatedAt: Date): boolean {
  return request.headers.get('if-none-match') === imageEtag(updatedAt);
}

export function imageCacheHeaders(
  updatedAt: Date,
  cacheControl = 'public, max-age=86400',
): Record<string, string> {
  return {
    etag: imageEtag(updatedAt),
    'cache-control': cacheControl,
  };
}

/** 304 for a matching If-None-Match, else null. */
export function notModified(
  request: Request,
  updatedAt: Date,
  cacheControl?: string,
): Response | null {
  if (!isFreshImage(request, updatedAt)) return null;
  return new Response(null, { status: 304, headers: imageCacheHeaders(updatedAt, cacheControl) });
}
