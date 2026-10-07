// Authenticated social accounts API: the networks the owner has connected.
// One row per platform per shop — the icons they tap to post. Auto-posting
// writes one draft per connected network.
import 'server-only';

import { NextResponse } from 'next/server';
import { SocialAccountBatch, SocialAccountList, SocialAccountRecord } from '@/lib/contracts/social';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const PLATFORM_ORDER = ['TIKTOK', 'INSTAGRAM', 'FACEBOOK_PAGE', 'WHATSAPP_STATUS'] as const;

function serializeAccount(row: {
  id: string;
  platform: (typeof PLATFORM_ORDER)[number];
  handle: string;
  url: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return SocialAccountRecord.parse({
    id: row.id,
    platform: row.platform,
    handle: row.handle,
    url: row.url,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    // Tenancy: reached through the caller's own store — no store yet means no
    // socials, not a 404 (the manager renders before the first save).
    const store = await prisma.store.findUnique({ where: { userId: user.id } });
    if (!store) return NextResponse.json(SocialAccountList.parse({ items: [] }));
    const rows = await prisma.socialAccount.findMany({
      where: { storeId: store.id },
      orderBy: { platform: 'asc' },
    });
    const items = rows
      .map(serializeAccount)
      .sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform));
    return NextResponse.json(SocialAccountList.parse({ items }));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = SocialAccountBatch.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const store = await prisma.store.findUnique({ where: { userId: user.id } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    // Replace the whole set: one row per platform, so delete-then-create keeps
    // the @@unique([storeId, platform]) invariant without upsert races.
    const cleaned = parsed.data.accounts.map((account) => ({
      platform: account.platform,
      handle: account.handle.trim(),
      url: account.url?.trim() ? account.url.trim() : null,
    }));

    await prisma.$transaction([
      prisma.socialAccount.deleteMany({ where: { storeId: store.id } }),
      ...(cleaned.length > 0
        ? [
            prisma.socialAccount.createMany({
              data: cleaned.map((account) => ({
                storeId: store.id,
                platform: account.platform,
                handle: account.handle,
                url: account.url,
              })),
            }),
          ]
        : []),
    ]);

    const rows = await prisma.socialAccount.findMany({
      where: { storeId: store.id },
      orderBy: { platform: 'asc' },
    });
    const items = rows
      .map(serializeAccount)
      .sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform));
    return NextResponse.json(SocialAccountList.parse({ items }));
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
