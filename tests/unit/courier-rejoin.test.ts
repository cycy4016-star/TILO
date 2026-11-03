// @vitest-environment node
// Re-opening a crew invite is also a profile correction — but only for the rider
// who already holds that rider's session. An anonymous caller who knows a phone
// number may attach a membership; they may not rewrite the profile or be handed
// a login for that account.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const tx = vi.hoisted(() => ({
  courier: { create: vi.fn(), update: vi.fn() },
  storeCourier: { upsert: vi.fn() },
  courierCrewInvite: { update: vi.fn() },
  deliveryEvent: { create: vi.fn() },
}));
const db = vi.hoisted(() => ({
  prisma: {
    courierCrewInvite: { findUnique: vi.fn() },
    courier: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => db);

const invite = {
  id: 'invite-1',
  storeId: 'store-1',
  revokedAt: null,
  expiresAt: new Date('2026-11-30T00:00:00.000Z'),
  store: {
    id: 'store-1',
    name: 'Ama Threads',
    slug: 'ama-threads',
    contactPhone: null,
    userId: 'user-1',
  },
};

const existingRider = {
  id: 'courier-1',
  name: 'Old Name',
  phone: '+233241234567',
  vehicleType: 'MOTORBIKE',
  plateNumber: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.courierCrewInvite.findUnique.mockResolvedValue(invite);
  db.prisma.courier.findUnique.mockResolvedValue(existingRider);
  tx.courier.update.mockResolvedValue({
    id: 'courier-1',
    name: 'New Name',
    phone: '+233241234567',
    vehicleType: 'CAR',
    plateNumber: 'GT-123',
  });
  tx.storeCourier.upsert.mockResolvedValue({ id: 'member-1', status: 'SUSPENDED' });
  tx.courierCrewInvite.update.mockResolvedValue({});
  tx.deliveryEvent.create.mockResolvedValue({});
  db.prisma.$transaction.mockImplementation(async (run: (client: typeof tx) => Promise<unknown>) =>
    run(tx),
  );
});

describe('joinCrew profile handling', () => {
  it('lets an authenticated rider correct their profile without changing membership status', async () => {
    const { joinCrew } = await import('@/lib/courier-invite');
    const result = await joinCrew({
      inviteToken: 'invite-token',
      name: 'New Name',
      phone: '024 123 4567',
      vehicleType: 'CAR',
      plateNumber: ' GT-123 ',
      authenticatedCourierId: 'courier-1',
    });

    expect(result).toEqual({
      courierId: 'courier-1',
      status: 'SUSPENDED',
      storeName: 'Ama Threads',
      canSignIn: true,
    });
    expect(tx.courier.update).toHaveBeenCalledWith({
      where: { id: 'courier-1' },
      data: { name: 'New Name', vehicleType: 'CAR', plateNumber: 'GT-123' },
    });
    expect(tx.courier.create).not.toHaveBeenCalled();
    expect(tx.storeCourier.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {},
        create: { storeId: 'store-1', courierId: 'courier-1', status: 'PENDING' },
      }),
    );
  });

  it('attaches a membership for a known phone without rewriting the rider or minting a login', async () => {
    const { joinCrew } = await import('@/lib/courier-invite');
    const result = await joinCrew({
      inviteToken: 'invite-token',
      name: 'Someone Else',
      phone: '024 123 4567',
      vehicleType: 'CAR',
      plateNumber: 'GT-999',
    });

    expect(result).toEqual({
      courierId: 'courier-1',
      status: 'SUSPENDED',
      storeName: 'Ama Threads',
      canSignIn: false,
    });
    expect(tx.courier.update).not.toHaveBeenCalled();
    expect(tx.courier.create).not.toHaveBeenCalled();
    expect(tx.storeCourier.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { storeId: 'store-1', courierId: 'courier-1', status: 'PENDING' },
      }),
    );
  });

  it('refuses to let a different signed-in rider take over a known phone', async () => {
    const { joinCrew } = await import('@/lib/courier-invite');
    const result = await joinCrew({
      inviteToken: 'invite-token',
      name: 'New Name',
      phone: '024 123 4567',
      vehicleType: 'CAR',
      authenticatedCourierId: 'courier-other',
    });

    expect(result.canSignIn).toBe(false);
    expect(tx.courier.update).not.toHaveBeenCalled();
  });

  it('creates a new rider with the submitted profile and signs them in', async () => {
    db.prisma.courier.findUnique.mockResolvedValueOnce(null);
    tx.courier.create.mockResolvedValue({
      id: 'courier-2',
      name: 'New Rider',
      phone: '+233241234567',
      vehicleType: 'BICYCLE',
      plateNumber: null,
    });
    tx.storeCourier.upsert.mockResolvedValueOnce({ id: 'member-2', status: 'PENDING' });

    const { joinCrew } = await import('@/lib/courier-invite');
    const result = await joinCrew({
      inviteToken: 'invite-token',
      name: 'New Rider',
      phone: '024 123 4567',
      vehicleType: 'BICYCLE',
    });

    expect(result.canSignIn).toBe(true);
    expect(tx.courier.create).toHaveBeenCalledWith({
      data: {
        name: 'New Rider',
        phone: '+233241234567',
        vehicleType: 'BICYCLE',
        plateNumber: null,
      },
    });
    expect(tx.courier.update).not.toHaveBeenCalled();
  });
});
