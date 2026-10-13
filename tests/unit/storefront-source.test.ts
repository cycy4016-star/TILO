// @vitest-environment node
//
// Storefront capture marking: who came in through the lead card, who typed
// themselves in, who just placed an order — and the inquiry counter that the
// platform's inquiry rate is built on.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const db = vi.hoisted(() => ({
  prisma: { customer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() } },
}));
vi.mock('@/lib/db', () => db);

const EXISTING = {
  id: 'c-1',
  name: 'Ama',
  phone: '+233240000000',
  address: 'Kumasi',
  source: 'OWNER',
  inquiryCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.customer.create.mockResolvedValue({
    id: 'c-new',
    name: 'Ama',
    phone: '+233240000000',
    address: null,
  });
  db.prisma.customer.update.mockResolvedValue(EXISTING);
});

describe('findOrCreateCustomer source marking', () => {
  it('stamps a first-time lead with its source, note and inquiry 1', async () => {
    db.prisma.customer.findFirst.mockResolvedValue(null);
    const { findOrCreateCustomer } = await import('@/lib/storefront');

    const result = await findOrCreateCustomer({
      userId: 'u-1',
      name: '  Ama  ',
      phone: '0240000000',
      town: 'Kumasi',
      note: 'Call me after 5',
      source: 'LEAD',
    });

    expect(result.created).toBe(true);
    expect(db.prisma.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u-1',
        name: 'Ama',
        source: 'LEAD',
        note: 'Call me after 5',
        inquiryCount: 1,
        lastInquiryAt: expect.any(Date),
      }),
    });
  });

  it('records an order capture as ORDER and leaves inquiries at zero', async () => {
    db.prisma.customer.findFirst.mockResolvedValue(null);
    const { findOrCreateCustomer } = await import('@/lib/storefront');

    await findOrCreateCustomer({
      userId: 'u-1',
      name: 'Kofi',
      phone: '0240000001',
      source: 'ORDER',
    });

    expect(db.prisma.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'ORDER',
        inquiryCount: 0,
        lastInquiryAt: null,
      }),
    });
  });

  it('keeps OWNER as the first-entry origin and only counts the new inquiry', async () => {
    db.prisma.customer.findFirst.mockResolvedValue(EXISTING);
    const { findOrCreateCustomer } = await import('@/lib/storefront');

    const result = await findOrCreateCustomer({
      userId: 'u-1',
      name: 'Ama',
      phone: '0240000000',
      source: 'LEAD',
    });

    expect(result.created).toBe(false);
    expect(db.prisma.customer.create).not.toHaveBeenCalled();
    expect(db.prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      // No `source` key: an owner-entered contact stays owner-entered.
      data: { inquiryCount: { increment: 1 }, lastInquiryAt: expect.any(Date) },
    });
  });

  it('upgrades a pre-tracking row from UNKNOWN to its real origin', async () => {
    db.prisma.customer.findFirst.mockResolvedValue({ ...EXISTING, source: 'UNKNOWN' });
    const { findOrCreateCustomer } = await import('@/lib/storefront');

    await findOrCreateCustomer({ userId: 'u-1', name: 'Ama', phone: '0240000000', source: 'LEAD' });

    expect(db.prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: expect.objectContaining({ source: 'LEAD', inquiryCount: { increment: 1 } }),
    });
  });

  it('writes nothing when a repeat capture brings no new information', async () => {
    db.prisma.customer.findFirst.mockResolvedValue({ ...EXISTING, source: 'ORDER' });
    const { findOrCreateCustomer } = await import('@/lib/storefront');

    await findOrCreateCustomer({
      userId: 'u-1',
      name: 'Ama',
      phone: '0240000000',
      source: 'ORDER',
    });

    expect(db.prisma.customer.create).not.toHaveBeenCalled();
    expect(db.prisma.customer.update).not.toHaveBeenCalled();
  });
});
