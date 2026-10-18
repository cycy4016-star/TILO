// @vitest-environment node
//
// Export tests: the CSV writer holds RFC-4180 (BOM, quoting, CRLF), the XLS
// writer escapes its cells, and the export route shape-checks its reports and
// stays behind the admin gate.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const gate = vi.hoisted(() => ({ requireAdminUser: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    store: { count: vi.fn(), findMany: vi.fn() },
    storeItem: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    storeCategory: { count: vi.fn() },
    customer: { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    order: { count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    orderLineItem: { findMany: vi.fn() },
    smsUsage: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    paymentTransaction: { count: vi.fn(), findMany: vi.fn() },
    appLog: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    feedback: { count: vi.fn(), findMany: vi.fn() },
    authEvent: { count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('@/lib/require-admin-api', () => gate);
vi.mock('@/lib/db', () => db);

beforeEach(() => {
  vi.clearAllMocks();
  gate.requireAdminUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  db.prisma.user.count.mockResolvedValue(0);
  db.prisma.store.count.mockResolvedValue(0);
  db.prisma.storeItem.count.mockResolvedValue(0);
  db.prisma.storeItem.aggregate.mockResolvedValue({ _count: 0 });
  db.prisma.storeItem.findMany.mockResolvedValue([]);
  db.prisma.storeCategory.count.mockResolvedValue(0);
  db.prisma.customer.count.mockResolvedValue(0);
  db.prisma.customer.aggregate.mockResolvedValue({ _sum: { inquiryCount: 0 } });
  db.prisma.customer.findMany.mockResolvedValue([]);
  db.prisma.order.count.mockResolvedValue(0);
  db.prisma.order.aggregate.mockResolvedValue({ _sum: { amountPesewas: 0 } });
  db.prisma.order.groupBy.mockResolvedValue([]);
  db.prisma.order.findMany.mockResolvedValue([]);
  db.prisma.orderLineItem.findMany.mockResolvedValue([]);
  db.prisma.smsUsage.count.mockResolvedValue(0);
  db.prisma.smsUsage.aggregate.mockResolvedValue({ _sum: { credits: 0 } });
  db.prisma.smsUsage.findMany.mockResolvedValue([]);
  db.prisma.paymentTransaction.count.mockResolvedValue(0);
  db.prisma.paymentTransaction.findMany.mockResolvedValue([]);
  db.prisma.appLog.count.mockResolvedValue(0);
  db.prisma.appLog.aggregate.mockResolvedValue({ _sum: { count: 0 } });
  db.prisma.appLog.findMany.mockResolvedValue([]);
  db.prisma.feedback.count.mockResolvedValue(0);
  db.prisma.feedback.findMany.mockResolvedValue([]);
  db.prisma.authEvent.count.mockResolvedValue(0);
  db.prisma.authEvent.groupBy.mockResolvedValue([]);
  db.prisma.authEvent.aggregate.mockResolvedValue({
    _count: { _all: 0 },
    _max: { createdAt: null },
  });
  db.prisma.authEvent.findMany.mockResolvedValue([]);
});

describe('export serializers', () => {
  it('writes RFC-4180 CSV with a BOM and escaped cells', async () => {
    const { sheetToCsv } = await import('@/lib/admin-export');
    const csv = sheetToCsv({
      title: 'Test',
      generatedAt: new Date('2026-10-18T00:00:00.000Z'),
      headers: ['Name', 'Note'],
      rows: [
        ['Ama', 'says "hi", loudly'],
        [null, 'line\nbreak'],
        [42, ''],
      ],
    });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Name,Note\r\n');
    expect(csv).toContain('Ama,"says ""hi"", loudly"\r\n');
    expect(csv).toContain(',"line\nbreak"\r\n'.replace('\n', '\n'));
    expect(csv).toContain('42,\r\n');
  });

  it('writes an XLS table with escaped content', async () => {
    const { sheetToXls } = await import('@/lib/admin-export');
    const xls = sheetToXls({
      title: 'Report <&>',
      generatedAt: new Date('2026-10-18T00:00:00.000Z'),
      headers: ['Item'],
      rows: [['<script>alert(1)</script>']],
    });
    expect(xls).toContain('Report &lt;&amp;&gt;');
    expect(xls).toContain('&lt;script&gt;');
    expect(xls).not.toContain('<script>');
  });
});

describe('admin export route', () => {
  it('rejects unknown reports', async () => {
    const { GET } = await import('@/app/api/admin/export/route');
    const response = await GET(new Request('http://test/api/admin/export?report=secrets'));
    expect(response.status).toBe(400);
  });

  it('exports the account ledger as CSV with sign-in history', async () => {
    db.prisma.user.findMany.mockResolvedValue([
      {
        id: 'u-1',
        name: 'Ama',
        email: 'ama@test.dev',
        phoneNumber: '+233240000000',
        role: 'user',
        banned: false,
        createdAt: new Date('2026-09-01T08:00:00.000Z'),
      },
    ]);
    db.prisma.authEvent.groupBy
      .mockResolvedValueOnce([
        {
          userId: 'u-1',
          _count: { _all: 4 },
          _max: { createdAt: new Date('2026-10-07T09:30:00.000Z') },
        },
      ])
      .mockResolvedValueOnce([{ userId: 'u-1', _count: { _all: 2 } }]);

    const { GET } = await import('@/app/api/admin/export/route');
    const response = await GET(new Request('http://test/api/admin/export?report=users&format=csv'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toContain('tilza-users-');
    const body = await response.text();
    expect(body).toContain('Name,Email,Phone,Role,Status,Signed up,Sign-ins,Last sign-in');
    expect(body).toContain('Ama,ama@test.dev,+233240000000,Owner,Active,');
    expect(body).toContain(',4,');
  });

  it('exports an XLS for the products report', async () => {
    const { GET } = await import('@/app/api/admin/export/route');
    const response = await GET(
      new Request('http://test/api/admin/export?report=products&format=xls'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/vnd.ms-excel');
    const body = await response.text();
    expect(body).toContain('<table>');
    expect(body).toContain('Item');
  });

  it('stays behind the admin gate', async () => {
    gate.requireAdminUser.mockRejectedValueOnce(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );
    const { GET } = await import('@/app/api/admin/export/route');
    const response = await GET(new Request('http://test/api/admin/export?report=users'));
    expect(response.status).toBe(403);
  });
});
