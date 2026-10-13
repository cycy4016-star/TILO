// public category cover — no auth. Serves the bytea stored on the shelf so
// the storefront can render category cards. 404 when there is no cover.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { imageCacheHeaders, notModified } from '@/lib/image-response';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ categoryId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { categoryId } = await context.params;
    const category = await prisma.productCategory.findFirst({
      where: { id: categoryId, store: { active: true }, active: true },
      select: { cover: true, coverMime: true, updatedAt: true },
    });
    if (!category || !category.cover) {
      return NextResponse.json({ error: 'Cover not found' }, { status: 404 });
    }
    const fresh = notModified(request, category.updatedAt);
    if (fresh) return fresh;
    return new Response(category.cover, {
      headers: {
        'content-type': category.coverMime ?? 'image/jpeg',
        ...imageCacheHeaders(category.updatedAt),
      },
    });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
