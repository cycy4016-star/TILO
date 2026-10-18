// Link-word availability for the onboarding wizard: the owner's client
// debounces calls to this route as they type so a taken slug is caught (with
// a free suggestion) before Save ever 409s. Auth'd and read-only.
import 'server-only';

import { NextResponse } from 'next/server';
import { SLUG_MAX, SlugCheck } from '@/lib/contracts/store';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { isValidSlug, slugify } from '@/lib/slug';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

// Free = no OTHER store holds it. The caller's own slug counts as free so
// re-saving the wizard with an unchanged link never reports "taken".
async function isFree(slug: string, userId: string): Promise<boolean> {
  const taken = await prisma.store.findFirst({
    where: { slug, NOT: { userId } },
    select: { id: true },
  });
  return !taken;
}

// "amas" -> "amas-2", "amas-3", ... Returns null when none were free. The
// stem is re-trimmed after slicing so a dash cut off by the length cap never
// produces "----2" style candidates.
async function suggest(base: string, userId: string): Promise<string | null> {
  const stem = base.slice(0, SLUG_MAX - 2).replace(/-+$/g, '');
  for (let n = 2; n <= 9; n += 1) {
    const candidate = `${stem}-${n}`;
    if (await isFree(candidate, userId)) return candidate;
  }
  return null;
}

function respond(payload: { slug: string; available: boolean; suggestion: string | null }) {
  return NextResponse.json(SlugCheck.parse(payload));
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const raw = (new URL(request.url).searchParams.get('slug') ?? '').trim().toLowerCase();

    if (isValidSlug(raw)) {
      const free = await isFree(raw, user.id);
      return respond({
        slug: raw,
        available: free,
        suggestion: free ? null : await suggest(raw, user.id),
      });
    }

    // Not a legal link word (capitals, spaces, too short...): hand back the
    // cleaned-up version when it can actually be used, so the wizard can offer
    // "use amas-boutique" instead of just complaining.
    const cleaned = slugify(raw);
    const suggestion = isValidSlug(cleaned)
      ? (await isFree(cleaned, user.id))
        ? cleaned
        : await suggest(cleaned, user.id)
      : null;
    return respond({ slug: raw, available: false, suggestion });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
