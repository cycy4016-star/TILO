// Tiny in-memory rate limiter for the public storefront capture routes so a
// bot can't hammer a store with fake orders or leads. Per-process only — good
// enough for a single-tenant deployment; a shared host would need a shared
// store, not a Map.
import 'server-only';

const buckets = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_MINUTE = 5;

export function allow(key: string, maxPerMinute: number = MAX_PER_MINUTE): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= maxPerMinute) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export function ipOf(request: Request): string {
  const proxy = process.env.IP_FORWARDED_HEADER ?? 'x-forwarded-for';
  const forwarded = request.headers.get(proxy);
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
