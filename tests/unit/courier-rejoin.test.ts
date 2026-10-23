// @vitest-environment node
// Re-opening a crew invite is also a profile correction: an existing rider's
// corrected name, vehicle and plate must reach the crew, while their membership
// status stays exactly where the merchant left it.
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

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.courierCrewInvite.findUnique.mockResolvedValue(invite);
  db.prisma.courier.findUnique.mockResolvedValue({
    id: 'courier-1',
    name: 'Old Name',
    phone: '+233241234567',
    vehicleType: 'MOTORBIKE',
    plateNumber: null,
  });
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

describe('joinCrew profile refresh', () => {
  it('updates an existing rider profile without changing membership status', async () => {
    const { joinCrew } = await import('@/lib/courier-invite');
    const result = await joinCrew({
      inviteToken: 'invite-token',
      name: 'New Name',
      phone: '024 123 4567',
      vehicleType: 'CAR',
      plateNumber: ' GT-123 ',
    });

    expect(result).toEqual({
      courierId: 'courier-1',
      status: 'SUSPENDED',
      storeName: 'Ama Threads',
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

  it('creates a new rider with the submitted profile', async () => {
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
    await joinCrew({
      inviteToken: 'invite-token',
      name: 'New Rider',
      phone: '024 123 4567',
      vehicleType: 'BICYCLE',
    });

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
