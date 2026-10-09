// public category cover — no auth. Serves the bytea stored on the shelf so
// the storefront can render category cards. 404 when there is no cover.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ categoryId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { categoryId } = await context.params;
    const category = await prisma.productCategory.findFirst({
      where: { id: categoryId, store: { active: true }, active: true },
      select: { cover: true, coverMime: true, updatedAt: true },
    });
    if (!category || !category.cover) {
      return NextResponse.json({ error: 'Cover not found' }, { status: 404 });
    }
    return new Response(category.cover, {
      headers: {
        'content-type': category.coverMime ?? 'image/jpeg',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
