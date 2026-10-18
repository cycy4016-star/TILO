// Error ledger: the single place a failure becomes a row the operator can read
// in /dashboard/admin (Health tab) instead of a stack trace in a terminal.
//
// Three rules govern everything here:
//   1. Fire-and-forget — a telemetry write must never block, slow or fail the
//      request that triggered it. Writes are pushed to `after()` and every
//      internal step swallows its own errors.
//   2. Group, don't spam — the same bug is folded onto one AppLog row keyed by
//      `fingerprint`, with an occurrence count, so 400 identical 500s read as
//      one incident.
//   3. No 4xx noise — a 401/404/409 is a conversation with the client, not a
//      platform fault. routeErrorResponse only records what's left.
import 'server-only';

import { after } from 'next/server';
import { captureAdminAlert } from '@/lib/admin-alerts';
import { prisma } from '@/lib/db';

const MAX_MESSAGE = 600;
const MAX_STACK = 6_000;
const MAX_FIELD = 300;

export type CaptureSource = 'SERVER' | 'CLIENT';

export type CaptureInput = {
  error?: unknown;
  message: string;
  stack?: string | null;
  digest?: string | null;
  route?: string | null;
  method?: string | null;
  status?: number | null;
  url?: string | null;
  userId?: string | null;
  source?: CaptureSource;
};

// ── normalisation ────────────────────────────────────────────────────────────
// Ids and numbers make every occurrence look unique, which defeats grouping.
// Strip them before hashing so `/api/orders/clx…` and `/api/orders/cm3…` are
// the same incident.
const VOLATILE: [RegExp, string][] = [
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ':uuid'],
  [/\b[cw][a-z0-9]{20,}\b/g, ':id'],
  [/\b0x[0-9a-f]+\b/gi, ':hex'],
  [/\b\d{4,}\b/g, ':n'],
  [/\s+/g, ' '],
];

/** Collapse an id- or number-bearing string into a stable grouping key. */
export function normalizeForFingerprint(value: string): string {
  let out = value;
  for (const [pattern, replacement] of VOLATILE) out = out.replace(pattern, replacement);
  return out.trim().toLowerCase();
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || 'Error';
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error) ?? 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

function stackOf(error: unknown): string | null {
  if (error instanceof Error && error.stack) return error.stack;
  return null;
}

function digestOf(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'digest' in error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === 'string' || typeof digest === 'number') return String(digest);
  }
  return null;
}

/** Truncate to a hard ceiling — a log row must never bloat the table. */
function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Turn an absolute URL into a route pattern. `/api/orders/cm3xyz` and
 * `/api/orders/abc123` must fingerprint identically, so volatile path segments
 * collapse to `:id`.
 */
export function routeOf(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const normalized = parts.map((part) => (normalizeForFingerprint(part) === part ? part : ':id'));
  return `/${normalized.join('/')}`;
}

/**
 * Pure-JS FNV-1a: three independent 32-bit passes, concatenated to the same
 * 24-hex-char key length this ledger has always written.
 *
 * Deliberately NOT node:crypto. `src/instrumentation.ts` pulls this module into
 * the edge instrumentation bundle, and a node builtin in there is a build
 * warning today and a runtime crash waiting for someone to drop the runtime
 * guard. This value only GROUPS incidents — it is a lookup key, never a
 * security digest — so a non-cryptographic hash is the right tool.
 */
function hashSeed(seed: string): string {
  let out = '';
  for (const basis of [0x811c9dc5, 0x9e3779b9, 0x85ebca6b]) {
    let hash = basis >>> 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    out += hash.toString(16).padStart(8, '0');
  }
  return out;
}

/** Stable grouping key: same route + same message = same incident. */
export function fingerprintOf(input: {
  message: string;
  route?: string | null;
  method?: string | null;
}): string {
  const seed = [
    input.method ?? '',
    routeOf(input.route ?? ''),
    normalizeForFingerprint(input.message),
  ]
    .join(' ')
    .trim();
  return hashSeed(seed);
}

/** Operator-facing one-liner: "POST /api/orders · 500". */
export function summarize(input: CaptureInput): string {
  const where = [input.method, input.route].filter(Boolean).join(' ');
  const status = input.status ? ` · ${input.status}` : '';
  return `${where || 'browser'}${status}`;
}

// ── write path ───────────────────────────────────────────────────────────────

/**
 * Persist one occurrence. Never throws — telemetry is allowed to fail silently,
 * the request it came from is not.
 */
export async function recordError(input: CaptureInput): Promise<void> {
  try {
    const message = clip(input.message || 'Unknown error', MAX_MESSAGE);
    const fingerprint = fingerprintOf({
      message,
      route: input.route,
      method: input.method,
    });
    const now = new Date();
    // A fingerprint that already has a row is a recurrence, not news — the
    // operator alert (and its WhatsApp-style ping) only fires for first
    // sightings so a 500-loop cannot spam the alert stream. The lookup gets
    // its own catch: if it hiccups we stay quiet rather than risk a ping storm
    // or lose the ledger write below.
    let firstSighting = false;
    try {
      const existing = await prisma.appLog.findUnique({
        where: { fingerprint },
        select: { id: true },
      });
      firstSighting = !existing;
    } catch {
      firstSighting = false;
    }
    await prisma.appLog.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        message,
        summary: summarize(input),
        route: input.route ?? null,
        method: input.method ?? null,
        status: input.status ?? null,
        digest: input.digest ?? null,
        stack: input.stack ? clip(input.stack, MAX_STACK) : null,
        userId: input.userId ?? null,
        url: input.url ? clip(input.url, MAX_FIELD) : null,
        source: input.source ?? 'SERVER',
        firstSeenAt: now,
        lastSeenAt: now,
      },
      // A recurrence clears any earlier "resolved" mark: it's back.
      update: {
        count: { increment: 1 },
        lastSeenAt: now,
        resolvedAt: null,
        message,
        summary: summarize(input),
        status: input.status ?? null,
        digest: input.digest ?? null,
        stack: input.stack ? clip(input.stack, MAX_STACK) : undefined,
        userId: input.userId ?? undefined,
        url: input.url ? clip(input.url, MAX_FIELD) : undefined,
      },
    });
    if (firstSighting) {
      await captureAdminAlert({
        kind: 'INCIDENT',
        title: `Incident · ${summarize(input)}`,
        body: `${input.source === 'CLIENT' ? 'browser' : 'server'} · ${message}`,
        refType: 'appLog',
        refId: fingerprint,
      });
    }
  } catch {
    // The ledger table may not exist yet (mid-deploy) or the DB may be down.
    // Losing a log line is acceptable; losing the request is not.
  }
}

/**
 * Schedule a write outside the response cycle. Inside a request scope this uses
 * `after()` so the row lands after the response is flushed; outside one (the
 * instrumentation hook has no request context on some runtimes) it degrades to
 * a detached promise.
 */
export function captureError(input: CaptureInput): void {
  const task = recordError(input);
  try {
    after(async () => {
      await task;
    });
  } catch {
    // No request scope — let the promise settle on its own.
  }
}

/**
 * Drop-in replacement for the boilerplate API catch tail:
 *
 *   } catch (error) {
 *     return routeErrorResponse(error, request);
 *   }
 *
 * A thrown `Response` (401/403/404/409/429 — the app's control flow) passes
 * straight through untouched. Anything else is recorded as an incident and
 * answered with the generic 500 the client already expects.
 */
export function routeErrorResponse(error: unknown, request?: Request): Response {
  if (error instanceof Response) return error;

  let route: string | null = null;
  let method: string | null = null;
  let url: string | null = null;
  if (request) {
    try {
      const parsed = new URL(request.url);
      route = routeOf(parsed.pathname);
      method = request.method;
      url = `${method} ${route}`;
    } catch {
      // A malformed URL is not worth reporting.
    }
  }

  captureError({
    error,
    message: messageOf(error),
    stack: stackOf(error),
    digest: digestOf(error),
    route,
    method,
    status: 500,
    url,
    source: 'SERVER',
  });

  return Response.json({ error: 'Internal Server Error' }, { status: 500 });
}

export { messageOf as errorMessageOf, stackOf as errorStackOf, digestOf as errorDigestOf };
