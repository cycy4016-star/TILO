// @vitest-environment node
// Admin proof gallery: consent is the entry gate, moderation is the exit gate.
// These tests pin the admin-only read, the consent filter, and approve/reject.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const gate = vi.hoisted(() => ({ requireAdminUser: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    deliveryProof: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/require-admin-api', () => gate);
vi.mock('@/lib/db', () => db);

const PROOF = {
  id: 'proof-1',
  orderId: 'order-1',
  createdAt: new Date('2026-10-23T10:00:00.000Z'),
  size: 24_000,
  mime: 'image/jpeg',
  reviewStatus: 'PENDING',
  reviewedAt: null,
  reviewNote: null,
  order: {
    orderNumber: 'TLZ-1001',
    customer: { name: 'Kofi' },
    user: { store: { name: 'Ama Threads' } },
  },
};

function jsonRequest(method: string, body?: unknown) {
  return new Request('http://test/api/admin/proofs', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  gate.requireAdminUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  db.prisma.deliveryProof.findMany.mockResolvedValue([PROOF]);
  db.prisma.deliveryProof.count.mockImplementation(
    ({ where }: { where?: { reviewStatus?: string } }) =>
      Promise.resolve(where?.reviewStatus === 'REJECTED' ? 0 : 1),
  );
  db.prisma.deliveryProof.findFirst.mockResolvedValue({ id: 'proof-1' });
  db.prisma.deliveryProof.update.mockResolvedValue({
    ...PROOF,
    reviewStatus: 'APPROVED',
    reviewedAt: new Date('2026-10-23T11:00:00.000Z'),
    reviewNote: 'Great shot',
  });
});

describe('admin proof gallery route', () => {
  it('stays behind the platform-admin gate', async () => {
    gate.requireAdminUser.mockRejectedValueOnce(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );
    const { GET } = await import('@/app/api/admin/proofs/route');
    const response = await GET(new Request('http://test/api/admin/proofs'));
    expect(response.status).toBe(403);
    expect(db.prisma.deliveryProof.findMany).not.toHaveBeenCalled();
  });

  it('lists only consented proofs with shop and buyer resolved', async () => {
    const { GET } = await import('@/app/api/admin/proofs/route');
    const response = await GET(new Request('http://test/api/admin/proofs?status=APPROVED'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      total: 1,
      pending: 1,
      approved: 1,
      rejected: 0,
    });
    expect(body.items[0]).toMatchObject({
      id: 'proof-1',
      orderNumber: 'TLZ-1001',
      shop: 'Ama Threads',
      buyer: 'Kofi',
      reviewStatus: 'PENDING',
      imageUrl: '/api/admin/proofs/proof-1/image',
    });
    expect(body.items[0].createdAt).toBe('2026-10-23T10:00:00.000Z');
    expect(db.prisma.deliveryProof.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { marketingConsent: true, reviewStatus: 'APPROVED' },
      }),
    );
  });

  it('approves a consented proof and records the reviewer', async () => {
    const { PUT } = await import('@/app/api/admin/proofs/route');
    const response = await PUT(
      jsonRequest('PUT', { id: 'proof-1', status: 'APPROVED', note: 'Great shot' }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: 'proof-1',
      reviewStatus: 'APPROVED',
      reviewNote: 'Great shot',
    });
    expect(db.prisma.deliveryProof.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proof-1' },
        data: expect.objectContaining({
          reviewStatus: 'APPROVED',
          reviewedBy: 'admin-1',
          reviewedAt: expect.any(Date),
          reviewNote: 'Great shot',
        }),
      }),
    );
  });

  it('refuses an invalid status before writing', async () => {
    const { PUT } = await import('@/app/api/admin/proofs/route');
    const response = await PUT(jsonRequest('PUT', { id: 'proof-1', status: 'MAYBE' }));
    expect(response.status).toBe(400);
    expect(db.prisma.deliveryProof.update).not.toHaveBeenCalled();
  });

  it('never exposes a proof without marketing consent', async () => {
    db.prisma.deliveryProof.findFirst.mockResolvedValueOnce(null);
    const { PUT } = await import('@/app/api/admin/proofs/route');
    const response = await PUT(jsonRequest('PUT', { id: 'proof-2', status: 'REJECTED' }));
    expect(response.status).toBe(404);
    expect(db.prisma.deliveryProof.update).not.toHaveBeenCalled();
  });
});

describe('admin proof image route', () => {
  it('serves only consented image bytes to an admin', async () => {
    db.prisma.deliveryProof.findFirst.mockResolvedValueOnce({
      data: new Uint8Array([1, 2, 3]),
      mime: 'image/jpeg',
    });
    const { GET } = await import('@/app/api/admin/proofs/[id]/image/route');
    const response = await GET(new Request('http://test/api/admin/proofs/proof-1/image'), {
      params: Promise.resolve({ id: 'proof-1' }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(db.prisma.deliveryProof.findFirst).toHaveBeenCalledWith({
      where: { id: 'proof-1', marketingConsent: true },
      select: { data: true, mime: true },
    });
  });
});
