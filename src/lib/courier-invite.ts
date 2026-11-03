// Merchant crew invite links. One shareable URL lets nearby riders apply; the
// merchant still approves each membership, so the link is a funnel, not an
// authorisation bypass.
import 'server-only';

import { hashToken, inviteExpiry, randomToken } from '@/lib/courier-auth';
import { prisma } from '@/lib/db';
import { toE164 } from '@/lib/phone';

export function appOrigin(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  if (request) return new URL(request.url).origin;
  return process.env.BETTER_AUTH_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000';
}

export async function getStoreForOwner(userId: string) {
  return prisma.store.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      slug: true,
      contactPhone: true,
      autoDispatch: true,
      dispatchRadiusKm: true,
    },
  });
}

export async function createCrewInvite(storeId: string, userId: string) {
  const token = randomToken();
  const expiresAt = inviteExpiry(30);

  // Rotating a link revokes the previous one. Existing approved crew keep their
  // sessions; only the application funnel is closed.
  await prisma.$transaction([
    prisma.courierCrewInvite.updateMany({
      where: { storeId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.courierCrewInvite.create({
      data: {
        storeId,
        createdBy: userId,
        token,
        tokenHash: hashToken(token),
        expiresAt,
      },
    }),
  ]);

  return { token, expiresAt };
}

export async function findInviteByToken(token: string) {
  if (!token || token.length > 200) return null;
  return prisma.courierCrewInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      store: {
        select: { id: true, name: true, slug: true, contactPhone: true, userId: true },
      },
    },
  });
}

export function inviteIsUsable(invite: { revokedAt: Date | null; expiresAt: Date }): boolean {
  return invite.revokedAt == null && invite.expiresAt.getTime() > Date.now();
}

export async function joinCrew(input: {
  inviteToken: string;
  name: string;
  phone: string;
  vehicleType: string;
  plateNumber?: string;
  // Present only when the request already carries this rider's courier session.
  // A public invite can attach a membership by phone, but it must never let an
  // anonymous caller rewrite an existing rider's profile or mint a session for
  // an account they have not proven they own.
  authenticatedCourierId?: string;
  request?: Request;
}) {
  const invite = await findInviteByToken(input.inviteToken);
  if (!invite || !inviteIsUsable(invite)) {
    throw Response.json(
      { error: 'This crew link has expired. Ask the shop for a new one.' },
      { status: 404 },
    );
  }

  const phone = toE164(input.phone);
  if (phone.replace(/\D/g, '').length < 9) {
    throw Response.json({ error: 'That phone number looks too short.' }, { status: 400 });
  }

  const existing = await prisma.courier.findUnique({ where: { phone } });
  if (existing?.status === 'BLOCKED') {
    throw Response.json(
      { error: 'This rider account is blocked. Contact the shop.' },
      { status: 403 },
    );
  }

  const ownsExistingAccount = existing != null && input.authenticatedCourierId === existing.id;
  const plateNumber = input.plateNumber?.trim() || null;
  const membership = await prisma.$transaction(async (tx) => {
    const courier = existing
      ? ownsExistingAccount
        ? // Re-opening an invite while signed in is still a profile correction:
          // the rider can fix their name, vehicle or plate without the crew
          // seeing stale details. Membership status is untouched.
          await tx.courier.update({
            where: { id: existing.id },
            data: { name: input.name, vehicleType: input.vehicleType, plateNumber },
          })
        : // Anonymous re-entry with a known phone only attaches a membership.
          // Editing the profile here would let anyone who knows a rider's phone
          // overwrite their details.
          existing
      : await tx.courier.create({
          data: {
            name: input.name,
            phone,
            vehicleType: input.vehicleType,
            plateNumber,
          },
        });

    const member = await tx.storeCourier.upsert({
      where: { storeId_courierId: { storeId: invite.storeId, courierId: courier.id } },
      create: { storeId: invite.storeId, courierId: courier.id, status: 'PENDING' },
      // Re-opening the link never self-approves or un-suspends a rider.
      update: {},
    });

    await tx.courierCrewInvite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 }, lastUsedAt: new Date() },
    });
    await tx.deliveryEvent.create({
      data: {
        storeId: invite.storeId,
        courierId: courier.id,
        actorType: 'COURIER',
        actorId: courier.id,
        type: 'JOINED',
      },
    });

    return { courier, member };
  });

  return {
    courierId: membership.courier.id,
    status: membership.member.status,
    storeName: invite.store.name,
    // Only a brand-new rider or the rider already holding this session may be
    // signed in by the join route.
    canSignIn: existing == null || ownsExistingAccount,
  };
}
