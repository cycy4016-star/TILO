// @vitest-environment node
//
// Admin Health + Feedback endpoints: both sit behind the platform-admin gate,
// both list their ledger, and both flip a row's status. This is the read/write
// surface under the new dashboard tabs.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const gate = vi.hoisted(() => ({ requireAdminUser: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    appLog: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    feedback: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/require-admin-api', () => gate);
vi.mock('@/lib/db', () => db);

const INCIDENT = {
  id: 'log-1',
  fingerprint: 'fp1',
  level: 'ERROR',
  source: 'SERVER',
  message: 'Connection pool exhausted',
  summary: 'POST /api/orders · 500',
  route: '/api/orders',
  method: 'POST',
  status: 500,
  digest: 'D1',
  stack: 'Error: Connection pool exhausted',
  userId: null,
  url: 'POST /api/orders',
  count: 42,
  resolvedAt: null,
  firstSeenAt: new Date('2026-10-01T10:00:00.000Z'),
  lastSeenAt: new Date('2026-10-03T10:00:00.000Z'),
};

const REPORT = {
  id: 'fb-1',
  kind: 'BUG',
  status: 'NEW',
  rating: 2,
  message: 'The basket resets when I go back',
  page: '/store/ama',
  email: 'ama@example.com',
  createdAt: new Date('2026-10-04T10:00:00.000Z'),
  store: { name: 'Shop A' },
  user: null,
  customer: { name: 'Kofi' },
};

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://test${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  gate.requireAdminUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
});

describe('admin logs route', () => {
  it('stays behind the platform-admin gate', async () => {
    gate.requireAdminUser.mockRejectedValueOnce(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );
    const { GET } = await import('@/app/api/admin/logs/route');
    const response = await GET(new Request('http://test/api/admin/logs'));
    expect(response.status).toBe(403);
    expect(db.prisma.appLog.findMany).not.toHaveBeenCalled();
  });

  it('lists incidents with an open tally and an occurrence sum', async () => {
    db.prisma.appLog.findMany.mockResolvedValue([
      INCIDENT,
      { ...INCIDENT, id: 'log-2', count: 3, resolvedAt: new Date('2026-10-02T00:00:00.000Z') },
    ]);
    db.prisma.appLog.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const { GET } = await import('@/app/api/admin/logs/route');
    const response = await GET(new Request('http://test/api/admin/logs'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(2);
    expect(body.open).toBe(1);
    expect(body.occurrences).toBe(45);
    expect(body.items[0]).toMatchObject({
      message: 'Connection pool exhausted',
      count: 42,
      resolved: false,
    });
    expect(body.items[1].resolved).toBe(true);
  });

  it('passes the filters through to the query', async () => {
    db.prisma.appLog.findMany.mockResolvedValue([]);
    db.prisma.appLog.count.mockResolvedValue(0);

    const { GET } = await import('@/app/api/admin/logs/route');
    await GET(new Request('http://test/api/admin/logs?source=CLIENT&status=resolved&q=timeout'));
    expect(db.prisma.appLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source: 'CLIENT',
          resolvedAt: { not: null },
          OR: expect.arrayContaining([
            { message: { contains: 'timeout', mode: 'insensitive' } },
            { stack: { contains: 'timeout', mode: 'insensitive' } },
          ]),
        },
      }),
    );
  });

  it('marks an incident resolved and rejects a malformed body', async () => {
    db.prisma.appLog.update.mockResolvedValue({ ...INCIDENT, resolvedAt: new Date() });
    const { PUT } = await import('@/app/api/admin/logs/route');

    const missing = await PUT(jsonRequest('/api/admin/logs', { resolved: true }));
    expect(missing.status).toBe(400);

    const badFlag = await PUT(jsonRequest('/api/admin/logs', { id: 'log-1', resolved: 'yes' }));
    expect(badFlag.status).toBe(400);
    expect(db.prisma.appLog.update).not.toHaveBeenCalled();

    const ok = await PUT(jsonRequest('/api/admin/logs', { id: 'log-1', resolved: true }));
    expect(ok.status).toBe(200);
    expect(db.prisma.appLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'log-1' }, data: { resolvedAt: expect.any(Date) } }),
    );
  });
});

describe('admin feedback route', () => {
  it('stays behind the platform-admin gate', async () => {
    gate.requireAdminUser.mockRejectedValueOnce(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );
    const { GET } = await import('@/app/api/admin/feedback/route');
    const response = await GET(new Request('http://test/api/admin/feedback'));
    expect(response.status).toBe(403);
    expect(db.prisma.feedback.findMany).not.toHaveBeenCalled();
  });

  it('lists reports with their shop and reporter resolved', async () => {
    db.prisma.feedback.findMany.mockResolvedValue([REPORT]);
    db.prisma.feedback.count.mockResolvedValueOnce(7).mockResolvedValueOnce(3);

    const { GET } = await import('@/app/api/admin/feedback/route');
    const response = await GET(new Request('http://test/api/admin/feedback?status=NEW'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(7);
    expect(body.newCount).toBe(3);
    expect(body.items[0]).toMatchObject({
      kind: 'BUG',
      status: 'NEW',
      rating: 2,
      shop: 'Shop A',
      reporter: 'Kofi',
    });
    expect(db.prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'NEW' } }),
    );
  });

  it('moves a report along the workflow and refuses an unknown status', async () => {
    db.prisma.feedback.update.mockResolvedValue({ ...REPORT, status: 'RESOLVED' });
    const { PUT } = await import('@/app/api/admin/feedback/route');

    const bad = await PUT(jsonRequest('/api/admin/feedback', { id: 'fb-1', status: 'DONE' }));
    expect(bad.status).toBe(400);
    expect(db.prisma.feedback.update).not.toHaveBeenCalled();

    const ok = await PUT(jsonRequest('/api/admin/feedback', { id: 'fb-1', status: 'RESOLVED' }));
    expect(ok.status).toBe(200);
    expect(db.prisma.feedback.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'fb-1' }, data: { status: 'RESOLVED' } }),
    );
    expect((await ok.json()).status).toBe('RESOLVED');
  });
});
