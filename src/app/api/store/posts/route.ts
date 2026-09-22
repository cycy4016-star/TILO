// authenticated social publishing log API: record a "Share to {platform}" on a
// store item, and list the store's push history.
import 'server-only';

import { NextResponse } from 'next/server';
import { SocialPostCreate, SocialPostList, SocialPostRecord } from '@/lib/contracts/social';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const POST_ORDER = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const store = await prisma.store.findFirst();
    if (!store) return NextResponse.json(SocialPostList.parse({ items: [] }));
    const posts = await prisma.storePost.findMany({
      where: { storeId: store.id },
      orderBy: POST_ORDER,
      include: { item: { select: { name: true } } },
      take: 100,
    });
    return NextResponse.json(SocialPostList.parse({ items: posts.map(serializePost) }));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = SocialPostCreate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const item = await prisma.storeItem.findUnique({ where: { id: parsed.data.itemId } });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const post = await prisma.storePost.create({
      data: {
        storeId: item.storeId,
        itemId: item.id,
        platform: parsed.data.platform,
        caption: parsed.data.caption,
        status: 'SHARED',
        externalUrl: null,
      },
      include: { item: { select: { name: true } } },
    });
    return NextResponse.json(serializePost(post), { status: 201 });
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
