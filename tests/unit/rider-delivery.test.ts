// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: {
    order: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

const job = {
  id: 'order-1',
  orderNumber: 'TILZA-20261021-A1B2C3D4',
  description: '1x Branded apron',
  deliveryStatus: 'PENDING_DISPATCH' as const,
  deliveryFeePesewas: 1700,
  riderId: null,
  customerLat: 5.556,
  customerLng: -0.1969,
  user: {
    store: {
      name: 'Kente Kitchen',
      address: '12 High Street, Accra',
      lat: 5.556,
      lng: -0.1969,
    },
  },
};

let visitorCount = 0;
function visitorIp() {
  visitorCount += 1;
  return `198.51.100.${visitorCount}`;
}

function acceptRequest(body: unknown) {
  return new Request('http://test/api/public/delivery/jobs/TILZA-20261021-A1B2C3D4/accept', {
    method: 'POST',
    headers: { 'x-forwarded-for': visitorIp() },
    body: JSON.stringify(body),
  });
}

const context = {
  params: Promise.resolve({ orderSlug: 'TILZA-20261021-A1B2C3D4' }),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('public rider job', () => {
  it('serves the pickup and drop-off pins for an open gig', async () => {
    db.prisma.order.findFirst.mockResolvedValue(job);
    const { GET } = await import('@/app/api/public/delivery/jobs/[orderSlug]/route');
    const response = await GET(
      new Request('http://test/api/public/delivery/jobs/TILZA-20261021-A1B2C3D4'),
      context,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      orderNumber: job.orderNumber,
      deliveryStatus: 'PENDING_DISPATCH',
      deliveryFeePesewas: 1700,
      store: { name: 'Kente Kitchen', lat: 5.556, lng: -0.1969 },
      customer: { lat: 5.556, lng: -0.1969 },
    });
    expect(db.prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fulfillmentMethod: 'LOCAL_DELIVERY' }),
      }),
    );
  });

  it('404s when the order is not a delivery with both pins', async () => {
    db.prisma.order.findFirst.mockResolvedValue({ ...job, customerLat: null });
    const { GET } = await import('@/app/api/public/delivery/jobs/[orderSlug]/route');
    const response = await GET(
      new Request('http://test/api/public/delivery/jobs/TILZA-20261021-A1B2C3D4'),
      context,
    );
    expect(response.status).toBe(404);
  });
});

describe('rider acceptance', () => {
  it('claims an open gig with an atomic compare-and-set', async () => {
    db.prisma.order.findFirst.mockResolvedValue(job);
    db.prisma.order.updateMany.mockResolvedValue({ count: 1 });
    const { POST } = await import('@/app/api/public/delivery/jobs/[orderSlug]/accept/route');
    const response = await POST(acceptRequest({ riderId: 'Kwesi 024 000 0000' }), context);
    expect(response.status).toBe(200);
    expect(db.prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', deliveryStatus: 'PENDING_DISPATCH' },
      data: { deliveryStatus: 'RIDER_ASSIGNED', riderId: 'Kwesi 024 000 0000' },
    });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      deliveryStatus: 'RIDER_ASSIGNED',
      riderId: 'Kwesi 024 000 0000',
      directionsUrl: expect.stringContaining('origin=5.556,-0.1969&destination=5.556,-0.1969'),
    });
  });

  it('lets the winning rider retry without reclaiming the gig', async () => {
    db.prisma.order.findFirst.mockResolvedValue({
      ...job,
      deliveryStatus: 'RIDER_ASSIGNED',
      riderId: 'Kwesi 024 000 0000',
    });
    const { POST } = await import('@/app/api/public/delivery/jobs/[orderSlug]/accept/route');
    const response = await POST(acceptRequest({ riderId: 'Kwesi 024 000 0000' }), context);
    expect(response.status).toBe(200);
    expect(db.prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('turns away a second rider', async () => {
    db.prisma.order.findFirst.mockResolvedValue({
      ...job,
      deliveryStatus: 'RIDER_ASSIGNED',
      riderId: 'Kwesi 024 000 0000',
    });
    const { POST } = await import('@/app/api/public/delivery/jobs/[orderSlug]/accept/route');
    const response = await POST(acceptRequest({ riderId: 'Esi 020 000 0000' }), context);
    expect(response.status).toBe(409);
    expect(db.prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('reports a lost race when the guarded update claims no row', async () => {
    db.prisma.order.findFirst.mockResolvedValue(job);
    db.prisma.order.updateMany.mockResolvedValue({ count: 0 });
    const { POST } = await import('@/app/api/public/delivery/jobs/[orderSlug]/accept/route');
    const response = await POST(acceptRequest({ riderId: 'Esi 020 000 0000' }), context);
    expect(response.status).toBe(409);
  });

  it('validates the rider identity before reading the order', async () => {
    const { POST } = await import('@/app/api/public/delivery/jobs/[orderSlug]/accept/route');
    const response = await POST(acceptRequest({ riderId: '' }), context);
    expect(response.status).toBe(400);
    expect(db.prisma.order.findFirst).not.toHaveBeenCalled();
  });
});
