// Auto-post generation API: turn the catalogue into ready-to-post drafts.
// GET returns the cadence as the dashboard renders it; POST picks one live
// item at random across the owner's shelves and writes one SHARED draft per
// connected network, so the owner just taps the icons to post.
import 'server-only';

import { NextResponse } from 'next/server';
import { buildAutoCaption, pickAutoPostSubject } from '@/lib/auto-post';
import { AutoPostGenerate, AutoPostGenerateResult, AutoPostSettings } from '@/lib/contracts/social';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

function settingsFor(store: { autoPostDays: number | null; autoPostLastAt: Date | null }) {
  const lastAt = store.autoPostLastAt ? store.autoPostLastAt.toISOString() : null;
  const nextAt =
    store.autoPostDays != null && store.autoPostLastAt
      ? new Date(store.autoPostLastAt.getTime() + store.autoPostDays * DAY_MS).toISOString()
      : null;
  return AutoPostSettings.parse({ days: store.autoPostDays, lastAt, nextAt });
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const store = await prisma.store.findUnique({ where: { userId: user.id } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    return NextResponse.json(settingsFor(store));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const parsed = AutoPostGenerate.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
        const message = messages[0];
        if (message) errors[field] = message;
      }
      return NextResponse.json({ errors }, { status: 400 });
    }

    const store = await prisma.store.findUnique({
      where: { userId: user.id },
      include: {
        items: true,
        categories: true,
        socials: true,
      },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (store.socials.length === 0) {
      return NextResponse.json(
        { errors: { form: 'Connect at least one social account first' } },
        { status: 400 },
      );
    }

    const now = new Date();
    const due =
      parsed.data.force === true ||
      store.autoPostDays == null ||
      store.autoPostLastAt == null ||
      now.getTime() >= store.autoPostLastAt.getTime() + store.autoPostDays * DAY_MS;

    if (!due) {
      return NextResponse.json(
        AutoPostGenerateResult.parse({ ok: true, generated: 0, at: now.toISOString() }),
      );
    }

    const subject = pickAutoPostSubject(
      store.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        pricePesewas: item.pricePesewas,
        categoryId: item.categoryId,
        active: item.active,
        hasImage: item.image != null,
      })),
      store.categories.map((category) => ({
        id: category.id,
        name: category.name,
        active: category.active,
      })),
    );

    // Nothing live to post about — leave lastAt alone so the next attempt
    // retries instead of starting a silent waiting period.
    if (!subject) {
      return NextResponse.json(
        AutoPostGenerateResult.parse({ ok: true, generated: 0, at: now.toISOString() }),
      );
    }

    const storeUrl = `${siteUrl}/store/${store.slug}`;
    const creates = store.socials.map((account) => {
      const caption = buildAutoCaption(subject, {
        storeName: store.name,
        storeUrl,
        platform: account.platform,
      });
      return prisma.storePost.create({
        data: {
          storeId: store.id,
          itemId: subject.item.id,
          platform: account.platform,
          status: 'SHARED',
          caption,
          externalUrl: null,
          auto: true,
        },
      });
    });

    await prisma.$transaction([
      ...creates,
      prisma.store.update({
        where: { id: store.id },
        data: { autoPostLastAt: now },
      }),
    ]);

    return NextResponse.json(
      AutoPostGenerateResult.parse({
        ok: true,
        generated: creates.length,
        at: now.toISOString(),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
