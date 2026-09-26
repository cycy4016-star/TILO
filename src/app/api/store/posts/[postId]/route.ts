// authenticated store post update/delete API: mark a push as posted (with the
// finished URL) or remove it from the log.
import 'server-only';

import { NextResponse } from 'next/server';
import { SocialPostRecord, SocialPostUpdate } from '@/lib/contracts/social';
import { prisma } from '@/lib/db';
import { requireOwnedStoreChild } from '@/lib/ownership';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ postId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { postId } = await context.params;
    // Tenancy: resolved through the caller's own store before any write.
    await requireOwnedStoreChild(user.id, 'post', postId);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = SocialPostUpdate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    // A post can only be marked PUBLISHED with the finished link; going back to
    // SHARED clears any link (it was not actually posted).
    if (parsed.data.status === 'PUBLISHED' && !parsed.data.externalUrl) {
      return NextResponse.json(
        { errors: { externalUrl: 'Add the finished post link' } },
        { status: 400 },
      );
    }

    const post = await prisma.storePost.update({
      where: { id: postId },
      data: {
        status: parsed.data.status,
        externalUrl: parsed.data.status === 'PUBLISHED' ? parsed.data.externalUrl : null,
      },
      include: { item: { select: { name: true } } },
    });
    return NextResponse.json(serializePost(post));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { postId } = await context.params;
    await requireOwnedStoreChild(user.id, 'post', postId);
    await prisma.storePost.delete({ where: { id: postId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function validationResponse(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages[0];
    if (message) errors[field] = message;
  }
  return NextResponse.json({ errors }, { status: 400 });
}

type PostedRow = {
  id: string;
  storeId: string;
  itemId: string;
  platform: 'TIKTOK' | 'INSTAGRAM' | 'FACEBOOK_PAGE' | 'WHATSAPP_STATUS';
  status: 'SHARED' | 'PUBLISHED';
  caption: string;
  externalUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  item: { name: string };
};

function serializePost(post: PostedRow) {
  return SocialPostRecord.parse({
    id: post.id,
    storeId: post.storeId,
    itemId: post.itemId,
    itemName: post.item.name,
    platform: post.platform,
    status: post.status,
    caption: post.caption,
    externalUrl: post.externalUrl,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  });
}
