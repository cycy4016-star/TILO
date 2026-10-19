// The vault: Tilza's self-archive. Snapshots the whole business world — every
// account, storefront, catalogue row, contact, order and ledger entry — into
// the WorldSnapshot table so the platform can never again lose its history
// silently. src/instrumentation.ts takes a snapshot on every boot (gapped) and
// once a day; the operator can take one on demand from the terminal. The
// console then diffs the live counts against the newest snapshot and shouts if
// anything shrank; scripts/vault-restore.mjs puts a snapshot back.
//
// Images (logos, banners, photos) live in Postgres as bytea. They ride along as
// base64 when a world is small enough for IMAGE_BUDGET; past that the snapshot
// is text-only and `imagesIncluded` says so, rather than quietly bloating the
// database it is supposed to be protecting.
import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { VAULT_COUNT_KEYS, type VaultCounts } from '@/lib/vault-diff';

export type WorldSnapshotTrigger = 'boot' | 'daily' | 'manual';

export type WorldSnapshotSummary = {
  id: string;
  createdAt: string;
  trigger: string;
  counts: VaultCounts;
  bytes: number;
  imagesIncluded: boolean;
};

/** Automatic snapshots older than this are pruned; manual ones are forever. */
export const VAULT_PRUNE_DAYS = 60;

// Raw bytes across every image in one world. Base64 inflates ~4/3, so this
// keeps a full snapshot comfortably under ~8MB of JSON.
const IMAGE_BUDGET = 6_000_000;

type World = {
  counts: VaultCounts;
  bytes: number;
  imagesIncluded: boolean;
  payload: Prisma.InputJsonValue;
};

/** JSON-safe copy: Dates become ISO strings, which is also what restore reads. */
function normalize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function base64(value: Uint8Array | null | undefined): string | null {
  return value ? Buffer.from(value).toString('base64') : null;
}

export async function collectWorld(): Promise<World> {
  const [
    userCount,
    storeCount,
    storesActive,
    storeItemCount,
    orderCount,
    customerCount,
    leadCount,
    feedbackCount,
    signupCount,
    signinCount,
    users,
    stores,
    storeImages,
    categories,
    categoryImages,
    items,
    itemImages,
    promotions,
    promotionImages,
    socials,
    customers,
    orders,
    orderLines,
    feedback,
    adminAlerts,
    authEvents,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.store.count(),
    prisma.store.count({ where: { active: true } }),
    prisma.storeItem.count(),
    prisma.order.count(),
    prisma.customer.count(),
    prisma.customer.count({ where: { source: 'LEAD' } }),
    prisma.feedback.count(),
    prisma.authEvent.count({ where: { kind: 'SIGNUP' } }),
    prisma.authEvent.count({ where: { kind: 'SIGNIN' } }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        banned: true,
        banReason: true,
        banExpires: true,
        inviteCode: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        trialEndsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.store.findMany({
      select: {
        id: true,
        userId: true,
        name: true,
        slug: true,
        tagline: true,
        description: true,
        contactPhone: true,
        active: true,
        promoBanner: true,
        theme: true,
        appearance: true,
        logoMime: true,
        bannerMime: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.store.findMany({ select: { id: true, logo: true, banner: true } }),
    prisma.productCategory.findMany({
      select: {
        id: true,
        storeId: true,
        name: true,
        sortOrder: true,
        active: true,
        icon: true,
        coverMime: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.productCategory.findMany({ select: { id: true, cover: true } }),
    prisma.storeItem.findMany({
      select: {
        id: true,
        storeId: true,
        categoryId: true,
        kind: true,
        name: true,
        description: true,
        pricePesewas: true,
        costPricePesewas: true,
        compareAtPricePesewas: true,
        sortOrder: true,
        active: true,
        stock: true,
        imageMime: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.storeItemImage.findMany({
      select: {
        id: true,
        itemId: true,
        position: true,
        image: true,
        imageMime: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.promotion.findMany({
      select: {
        id: true,
        storeId: true,
        name: true,
        code: true,
        kind: true,
        value: true,
        minSubtotalPesewas: true,
        itemIds: true,
        categoryIds: true,
        active: true,
        startsAt: true,
        endsAt: true,
        imageMime: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.promotion.findMany({ select: { id: true, image: true } }),
    prisma.socialAccount.findMany({
      select: {
        id: true,
        storeId: true,
        platform: true,
        handle: true,
        url: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.customer.findMany({
      select: {
        id: true,
        userId: true,
        name: true,
        company: true,
        email: true,
        phone: true,
        address: true,
        source: true,
        note: true,
        inquiryCount: true,
        lastInquiryAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.order.findMany({
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        customerId: true,
        description: true,
        status: true,
        amountPesewas: true,
        discountPesewas: true,
        promoCode: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.orderLineItem.findMany({
      select: {
        id: true,
        orderId: true,
        storeItemId: true,
        name: true,
        unitPricePesewas: true,
        unitCostPesewas: true,
        quantity: true,
        createdAt: true,
      },
    }),
    prisma.feedback.findMany({
      select: {
        id: true,
        userId: true,
        storeId: true,
        customerId: true,
        kind: true,
        rating: true,
        message: true,
        page: true,
        email: true,
        userAgent: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.adminAlert.findMany({
      select: {
        id: true,
        userId: true,
        kind: true,
        title: true,
        body: true,
        amountPesewas: true,
        count: true,
        refType: true,
        refId: true,
        windowStart: true,
        windowEnd: true,
        digestKey: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.authEvent.findMany({
      select: {
        id: true,
        userId: true,
        kind: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    }),
  ]);

  const imageBytes =
    storeImages.reduce(
      (total, row) => total + (row.logo?.length ?? 0) + (row.banner?.length ?? 0),
      0,
    ) +
    categoryImages.reduce((total, row) => total + (row.cover?.length ?? 0), 0) +
    itemImages.reduce((total, row) => total + (row.image?.length ?? 0), 0) +
    promotionImages.reduce((total, row) => total + (row.image?.length ?? 0), 0);
  const imagesIncluded = imageBytes <= IMAGE_BUDGET;

  const storeImageById = new Map(storeImages.map((row) => [row.id, row]));
  const categoryImageById = new Map(categoryImages.map((row) => [row.id, row]));
  const promotionImageById = new Map(promotionImages.map((row) => [row.id, row]));

  const counts: VaultCounts = {
    users: userCount,
    stores: storeCount,
    storesActive,
    items: storeItemCount,
    orders: orderCount,
    customers: customerCount,
    leads: leadCount,
    feedback: feedbackCount,
    signups: signupCount,
    signins: signinCount,
  };

  const payload = normalize({
    version: 1,
    takenAt: new Date().toISOString(),
    imagesIncluded,
    counts,
    users,
    stores: stores.map((row) => {
      const image = storeImageById.get(row.id);
      return imagesIncluded
        ? { ...row, logoB64: base64(image?.logo), bannerB64: base64(image?.banner) }
        : row;
    }),
    categories: categories.map((row) => {
      const image = categoryImageById.get(row.id);
      return imagesIncluded ? { ...row, coverB64: base64(image?.cover) } : row;
    }),
    items,
    itemGallery: itemImages.map(({ image, ...row }) =>
      imagesIncluded ? { ...row, imageB64: base64(image) } : row,
    ),
    promotions: promotions.map((row) => {
      const image = promotionImageById.get(row.id);
      return imagesIncluded ? { ...row, imageB64: base64(image?.image) } : row;
    }),
    socials,
    customers,
    orders,
    orderLines,
    feedback,
    adminAlerts,
    authEvents,
  });

  return {
    counts,
    bytes: Buffer.byteLength(JSON.stringify(payload)),
    imagesIncluded,
    payload,
  };
}

function summaryOf(row: {
  id: string;
  createdAt: Date;
  trigger: string;
  counts: Prisma.JsonValue;
  bytes: number;
  imagesIncluded: boolean;
}): WorldSnapshotSummary {
  const source = (row.counts ?? {}) as Record<string, unknown>;
  const counts = {} as VaultCounts;
  for (const key of VAULT_COUNT_KEYS) {
    counts[key] = Number(source[key] ?? 0) || 0;
  }
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    trigger: row.trigger,
    counts,
    bytes: row.bytes,
    imagesIncluded: row.imagesIncluded,
  };
}

/**
 * Archive the world. `minGapMs` keeps automatic triggers from stacking — a
 * boot only snapshots if the last one is older than the gap, so redeploys do
 * not spam the table. Manual snapshots always run. Returns null when skipped.
 */
export async function createWorldSnapshot(
  trigger: WorldSnapshotTrigger,
  options: { minGapMs?: number } = {},
): Promise<WorldSnapshotSummary | null> {
  if (options.minGapMs) {
    const last = await prisma.worldSnapshot.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (last && Date.now() - last.createdAt.getTime() < options.minGapMs) return null;
  }

  const world = await collectWorld();
  const row = await prisma.worldSnapshot.create({
    data: {
      trigger,
      counts: world.counts,
      bytes: world.bytes,
      imagesIncluded: world.imagesIncluded,
      payload: world.payload,
    },
  });

  // Pruning is housekeeping: a failure here must not fail the snapshot the
  // caller just took.
  try {
    const cutoff = new Date(Date.now() - VAULT_PRUNE_DAYS * 86_400_000);
    await prisma.worldSnapshot.deleteMany({
      where: { trigger: { not: 'manual' }, createdAt: { lt: cutoff } },
    });
  } catch {
    // Leave the old rows; the next snapshot will try again.
  }

  return summaryOf(row);
}

export async function listWorldSnapshots(limit = 100): Promise<WorldSnapshotSummary[]> {
  const rows = await prisma.worldSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      trigger: true,
      counts: true,
      bytes: true,
      imagesIncluded: true,
    },
  });
  return rows.map(summaryOf);
}

/** The live world's headline counts — what the newest snapshot is checked against. */
export async function currentWorldCounts(): Promise<VaultCounts> {
  const [users, stores, storesActive, items, orders, customers, leads, feedback, signups, signins] =
    await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.store.count({ where: { active: true } }),
      prisma.storeItem.count(),
      prisma.order.count(),
      prisma.customer.count(),
      prisma.customer.count({ where: { source: 'LEAD' } }),
      prisma.feedback.count(),
      prisma.authEvent.count({ where: { kind: 'SIGNUP' } }),
      prisma.authEvent.count({ where: { kind: 'SIGNIN' } }),
    ]);
  return {
    users,
    stores,
    storesActive,
    items,
    orders,
    customers,
    leads,
    feedback,
    signups,
    signins,
  };
}
