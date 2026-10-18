// @vitest-environment node
//
// Operator alert pipeline. Two halves under test:
//   1. captureAdminAlert — per-admin cadence gating (OFF silences, INSTANT
//      writes now, HOURLY/DAILY defer), amount floors, best-effort behaviour
//      and the short settings cache.
//   2. flushDueAdminAlerts — closed-window bucketing, digest content, the
//      idempotent digestKey upsert, hygiene for abandoned events, retention.
// Prisma is mocked at the @/lib/db boundary, matching tests/unit conventions.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const db = vi.hoisted(() => ({
  prisma: {
    user: { findMany: vi.fn() },
    adminAlertSetting: { findMany: vi.fn() },
    adminAlert: { createMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    adminAlertEvent: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => db);

const load = () => import('@/lib/admin-alerts');

type UpsertArgs = {
  where: { digestKey: string };
  create: Record<string, unknown>;
  update: unknown;
};

const upsertArgs = (index = 0): UpsertArgs =>
  db.prisma.adminAlert.upsert.mock.calls[index]?.[0] as UpsertArgs;

beforeEach(async () => {
  vi.resetAllMocks();
  const { invalidateAdminAlertCache } = await load();
  invalidateAdminAlertCache();
});

describe('digestWindowStart', () => {
  it('floors hourly windows within the hour', async () => {
    const { digestWindowStart } = await load();
    expect(digestWindowStart('HOURLY', new Date('2026-10-18T09:59:59.999Z'))).toBe(
      Date.UTC(2026, 9, 18, 9),
    );
    expect(digestWindowStart('HOURLY', new Date('2026-10-18T09:00:00.000Z'))).toBe(
      Date.UTC(2026, 9, 18, 9),
    );
  });

  it('floors daily windows to UTC midnight', async () => {
    const { digestWindowStart } = await load();
    expect(digestWindowStart('DAILY', new Date('2026-10-18T23:59:00.000Z'))).toBe(
      Date.UTC(2026, 9, 18, 0),
    );
    expect(digestWindowStart('DAILY', new Date('2026-10-18T00:00:00.000Z'))).toBe(
      Date.UTC(2026, 9, 18, 0),
    );
  });
});

describe('captureAdminAlert', () => {
  it('fires instantly for an admin with no setting row', async () => {
    db.prisma.user.findMany.mockResolvedValue([{ id: 'a1' }]);
    db.prisma.adminAlertSetting.findMany.mockResolvedValue([]);
    db.prisma.adminAlert.createMany.mockResolvedValue({ count: 1 });

    const { captureAdminAlert } = await load();
    await captureAdminAlert({
      kind: 'ORDER',
      title: 'Order TILZA-1 · GH₵12.00',
      amountPesewas: 1200,
      refType: 'order',
      refId: 'o1',
    });

    expect(db.prisma.adminAlert.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'a1',
          kind: 'ORDER',
          title: 'Order TILZA-1 · GH₵12.00',
          body: null,
          amountPesewas: 1200,
          refType: 'order',
          refId: 'o1',
        },
      ],
    });
    expect(db.prisma.adminAlertEvent.createMany).not.toHaveBeenCalled();
  });

  it('stays silent when the cadence is OFF', async () => {
    db.prisma.user.findMany.mockResolvedValue([{ id: 'a1' }]);
    db.prisma.adminAlertSetting.findMany.mockResolvedValue([
      { userId: 'a1', kind: 'ORDER', cadence: 'OFF', minAmountPesewas: null },
    ]);

    const { captureAdminAlert } = await load();
    await captureAdminAlert({ kind: 'ORDER', title: 'Order TILZA-1' });

    expect(db.prisma.adminAlert.createMany).not.toHaveBeenCalled();
    expect(db.prisma.adminAlertEvent.createMany).not.toHaveBeenCalled();
  });

  it('applies the amount floor, but lets null amounts through', async () => {
    db.prisma.user.findMany.mockResolvedValue([{ id: 'a1' }]);
    db.prisma.adminAlertSetting.findMany.mockResolvedValue([
      { userId: 'a1', kind: 'PAYMENT', cadence: 'INSTANT', minAmountPesewas: 5000 },
    ]);
    db.prisma.adminAlert.createMany.mockResolvedValue({ count: 1 });

    const { captureAdminAlert } = await load();
    await captureAdminAlert({ kind: 'PAYMENT', title: 'Payment 49.99', amountPesewas: 4999 });
    expect(db.prisma.adminAlert.createMany).not.toHaveBeenCalled();

    await captureAdminAlert({ kind: 'PAYMENT', title: 'Payment 50.00', amountPesewas: 5000 });
    expect(db.prisma.adminAlert.createMany).toHaveBeenCalledTimes(1);

    await captureAdminAlert({ kind: 'PAYMENT', title: 'Payment (amount unknown)' });
    expect(db.prisma.adminAlert.createMany).toHaveBeenCalledTimes(2);
  });

  it('defers HOURLY and DAILY cadences to the event table', async () => {
    db.prisma.user.findMany.mockResolvedValue([{ id: 'a1' }]);
    db.prisma.adminAlertSetting.findMany.mockResolvedValue([
      { userId: 'a1', kind: 'ORDER', cadence: 'HOURLY', minAmountPesewas: null },
    ]);
    db.prisma.adminAlertEvent.createMany.mockResolvedValue({ count: 1 });

    const { captureAdminAlert } = await load();
    await captureAdminAlert({ kind: 'ORDER', title: 'Order TILZA-2', amountPesewas: 800 });

    expect(db.prisma.adminAlertEvent.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'a1',
          kind: 'ORDER',
          title: 'Order TILZA-2',
          body: null,
          amountPesewas: 800,
          refType: null,
          refId: null,
        },
      ],
    });
    expect(db.prisma.adminAlert.createMany).not.toHaveBeenCalled();
  });

  it('splits delivery per admin when cadences differ', async () => {
    db.prisma.user.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    db.prisma.adminAlertSetting.findMany.mockResolvedValue([
      { userId: 'a2', kind: 'ORDER', cadence: 'DAILY', minAmountPesewas: null },
    ]);
    db.prisma.adminAlert.createMany.mockResolvedValue({ count: 1 });
    db.prisma.adminAlertEvent.createMany.mockResolvedValue({ count: 1 });

    const { captureAdminAlert } = await load();
    await captureAdminAlert({ kind: 'ORDER', title: 'Order TILZA-3' });

    expect(db.prisma.adminAlert.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: 'a1' })],
    });
    expect(db.prisma.adminAlertEvent.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: 'a2' })],
    });
  });

  it('never throws when the database is down', async () => {
    db.prisma.user.findMany.mockRejectedValue(new Error('db down'));

    const { captureAdminAlert } = await load();
    await expect(
      captureAdminAlert({ kind: 'SIGNUP', title: 'Ama joined' }),
    ).resolves.toBeUndefined();
    expect(db.prisma.adminAlert.createMany).not.toHaveBeenCalled();
  });

  it('caches the admin + settings lookup until invalidated', async () => {
    db.prisma.user.findMany.mockResolvedValue([{ id: 'a1' }]);
    db.prisma.adminAlertSetting.findMany.mockResolvedValue([]);
    db.prisma.adminAlert.createMany.mockResolvedValue({ count: 1 });

    const { captureAdminAlert, invalidateAdminAlertCache } = await load();
    await captureAdminAlert({ kind: 'ORDER', title: 'One' });
    await captureAdminAlert({ kind: 'ORDER', title: 'Two' });
    expect(db.prisma.user.findMany).toHaveBeenCalledTimes(1);

    invalidateAdminAlertCache();
    await captureAdminAlert({ kind: 'ORDER', title: 'Three' });
    expect(db.prisma.user.findMany).toHaveBeenCalledTimes(2);
  });
});

describe('flushDueAdminAlerts', () => {
  const now = new Date('2026-10-18T10:00:30.000Z');
  const H8 = Date.UTC(2026, 9, 18, 8);
  const H9 = Date.UTC(2026, 9, 18, 9);
  const H10 = Date.UTC(2026, 9, 18, 10);

  function prime() {
    db.prisma.user.findMany.mockResolvedValue([{ id: 'a1' }]);
    db.prisma.adminAlertSetting.findMany.mockResolvedValue([
      { userId: 'a1', kind: 'ORDER', cadence: 'HOURLY' },
    ]);
    db.prisma.adminAlertEvent.updateMany.mockResolvedValue({ count: 1 });
    db.prisma.adminAlert.upsert.mockResolvedValue({});
    db.prisma.adminAlert.deleteMany.mockResolvedValue({ count: 0 });
    db.prisma.adminAlertEvent.deleteMany.mockResolvedValue({ count: 0 });
  }

  it('throttles without force', async () => {
    db.prisma.user.findMany.mockResolvedValue([{ id: 'a1' }]);
    db.prisma.adminAlertSetting.findMany.mockResolvedValue([]);
    db.prisma.adminAlertEvent.updateMany.mockResolvedValue({ count: 0 });

    const { flushDueAdminAlerts } = await load();
    await flushDueAdminAlerts({ now, force: true });
    expect(db.prisma.user.findMany).toHaveBeenCalledTimes(1);

    const second = await flushDueAdminAlerts({ now: new Date(now.getTime() + 5_000) });
    expect(second).toEqual({ created: 0 });
    expect(db.prisma.user.findMany).toHaveBeenCalledTimes(1);
  });

  it('buckets closed windows, sums amounts and marks events consumed', async () => {
    prime();
    db.prisma.adminAlertEvent.findMany.mockResolvedValue([
      {
        id: 'e1',
        title: 'Order TILZA-1 · GH₵12.00',
        amountPesewas: 1200,
        createdAt: new Date('2026-10-18T08:10:00.000Z'),
      },
      {
        id: 'e2',
        title: 'Order TILZA-2 · GH₵8.00',
        amountPesewas: 800,
        createdAt: new Date('2026-10-18T09:05:00.000Z'),
      },
    ]);

    const { flushDueAdminAlerts } = await load();
    const result = await flushDueAdminAlerts({ now, force: true });
    expect(result).toEqual({ created: 2 });

    expect(db.prisma.adminAlertEvent.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'a1',
        kind: 'ORDER',
        flushedAt: null,
        createdAt: { lt: new Date(H10) },
      },
      orderBy: { createdAt: 'asc' },
      take: 400,
      select: { id: true, title: true, amountPesewas: true, createdAt: true },
    });

    expect(db.prisma.adminAlert.upsert.mock.calls).toHaveLength(2);
    const first = upsertArgs(0);
    const second = upsertArgs(1);
    expect(first.where).toEqual({ digestKey: `a1:ORDER:HOURLY:${H8}` });
    expect(first.create).toMatchObject({
      digestKey: `a1:ORDER:HOURLY:${H8}`,
      kind: 'ORDER',
      title: '1 new order · last hour',
      body: 'Order TILZA-1 · GH₵12.00',
      amountPesewas: 1200,
      count: 1,
      windowStart: new Date(H8),
      windowEnd: new Date(H9),
      createdAt: new Date(H9),
    });
    expect(first.update).toEqual({});
    expect(second.create).toMatchObject({
      digestKey: `a1:ORDER:HOURLY:${H9}`,
      windowStart: new Date(H9),
      windowEnd: new Date(H10),
      createdAt: new Date(H10),
    });

    expect(db.prisma.adminAlertEvent.updateMany).toHaveBeenNthCalledWith(1, {
      where: { flushedAt: null, NOT: [{ userId: 'a1', kind: 'ORDER' }] },
      data: { flushedAt: now },
    });
    expect(db.prisma.adminAlertEvent.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ['e1'] } },
      data: { flushedAt: now },
    });
    expect(db.prisma.adminAlertEvent.updateMany).toHaveBeenNthCalledWith(3, {
      where: { id: { in: ['e2'] } },
      data: { flushedAt: now },
    });

    expect(db.prisma.adminAlertEvent.deleteMany).toHaveBeenCalledWith({
      where: { flushedAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } },
    });
    expect(db.prisma.adminAlert.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date(now.getTime() - 90 * 86_400_000) } },
    });
  });

  it('summarises busy windows with a preview and a +N tail', async () => {
    prime();
    db.prisma.adminAlertEvent.findMany.mockResolvedValue([
      {
        id: 'e1',
        title: 'Order A',
        amountPesewas: 1000,
        createdAt: new Date('2026-10-18T09:05:00.000Z'),
      },
      {
        id: 'e2',
        title: 'Order B',
        amountPesewas: 2000,
        createdAt: new Date('2026-10-18T09:15:00.000Z'),
      },
      {
        id: 'e3',
        title: 'Order C',
        amountPesewas: null,
        createdAt: new Date('2026-10-18T09:25:00.000Z'),
      },
      {
        id: 'e4',
        title: 'Order D',
        amountPesewas: 500,
        createdAt: new Date('2026-10-18T09:35:00.000Z'),
      },
      {
        id: 'e5',
        title: 'Order E',
        amountPesewas: 300,
        createdAt: new Date('2026-10-18T09:45:00.000Z'),
      },
    ]);

    const { flushDueAdminAlerts } = await load();
    await flushDueAdminAlerts({ now, force: true });

    const digest = upsertArgs().create;
    expect(digest).toMatchObject({
      title: '5 new orders · last hour',
      amountPesewas: 3800,
      count: 5,
    });
    expect(digest.body).toBe('Order A · Order B · Order C · Order D · +1 more');
  });

  it('parks events whose cadence was switched off mid-window', async () => {
    db.prisma.user.findMany.mockResolvedValue([{ id: 'a1' }]);
    db.prisma.adminAlertSetting.findMany.mockResolvedValue([]);
    db.prisma.adminAlertEvent.updateMany.mockResolvedValue({ count: 3 });

    const { flushDueAdminAlerts } = await load();
    const result = await flushDueAdminAlerts({ now, force: true });

    expect(result).toEqual({ created: 0 });
    expect(db.prisma.adminAlertEvent.updateMany).toHaveBeenCalledWith({
      where: { flushedAt: null, NOT: [] },
      data: { flushedAt: now },
    });
    expect(db.prisma.adminAlert.upsert).not.toHaveBeenCalled();
  });

  it('re-upserts the same digestKey when a racing poller repeats the flush', async () => {
    prime();
    const events = [
      {
        id: 'e1',
        title: 'Order TILZA-1',
        amountPesewas: 1200,
        createdAt: new Date('2026-10-18T09:05:00.000Z'),
      },
    ];
    db.prisma.adminAlertEvent.findMany.mockResolvedValue(events);

    const { flushDueAdminAlerts } = await load();
    await flushDueAdminAlerts({ now, force: true });
    await flushDueAdminAlerts({ now, force: true });

    const keys = db.prisma.adminAlert.upsert.mock.calls.map(
      (call) => (call[0] as UpsertArgs).where.digestKey,
    );
    expect(keys).toEqual([`a1:ORDER:HOURLY:${H9}`, `a1:ORDER:HOURLY:${H9}`]);
    for (const call of db.prisma.adminAlert.upsert.mock.calls) {
      expect((call[0] as UpsertArgs).update).toEqual({});
    }
  });

  it('returns empty when the lookup fails', async () => {
    db.prisma.user.findMany.mockRejectedValue(new Error('db down'));

    const { flushDueAdminAlerts } = await load();
    await expect(flushDueAdminAlerts({ now, force: true })).resolves.toEqual({ created: 0 });
  });
});

describe('listAdminAlertSettings', () => {
  it('fills defaults for kinds without a row, preserving order', async () => {
    db.prisma.adminAlertSetting.findMany.mockResolvedValue([
      { userId: 'a1', kind: 'PAYMENT', cadence: 'DAILY', minAmountPesewas: 5000 },
    ]);

    const { ADMIN_ALERT_KINDS, listAdminAlertSettings } = await load();
    const rows = await listAdminAlertSettings('a1');

    expect(rows.map((row) => row.kind)).toEqual([...ADMIN_ALERT_KINDS]);
    expect(rows.find((row) => row.kind === 'PAYMENT')).toEqual({
      kind: 'PAYMENT',
      cadence: 'DAILY',
      minAmountPesewas: 5000,
    });
    expect(rows.find((row) => row.kind === 'SIGNUP')).toEqual({
      kind: 'SIGNUP',
      cadence: 'INSTANT',
      minAmountPesewas: null,
    });
    expect(db.prisma.adminAlertSetting.findMany).toHaveBeenCalledWith({ where: { userId: 'a1' } });
  });
});

describe('alert contracts', () => {
  it('accepts a feed payload and rejects unknown kinds', async () => {
    const { AlertsFeed } = await import('@/lib/contracts/admin-alerts');
    const record = {
      id: 'al1',
      kind: 'ORDER',
      title: 'Order TILZA-1 · GH₵12.00',
      body: null,
      amountPesewas: 1200,
      count: 1,
      windowStart: null,
      windowEnd: null,
      readAt: null,
      createdAt: '2026-10-18T09:05:00.000Z',
    };
    const feed = {
      alerts: [record],
      unread: 1,
      settings: [{ kind: 'ORDER', cadence: 'INSTANT', minAmountPesewas: null }],
      generatedAt: '2026-10-18T10:00:00.000Z',
    };
    expect(AlertsFeed.safeParse(feed).success).toBe(true);
    expect(AlertsFeed.safeParse({ ...feed, alerts: [{ ...record, kind: 'TWEET' }] }).success).toBe(
      false,
    );
  });

  it('bounds the settings floor so a typo cannot mute everything', async () => {
    const { AlertsSettingsUpdate } = await import('@/lib/contracts/admin-alerts');
    expect(
      AlertsSettingsUpdate.safeParse({ kind: 'PAYMENT', cadence: 'DAILY', minAmountPesewas: -1 })
        .success,
    ).toBe(false);
    expect(
      AlertsSettingsUpdate.safeParse({
        kind: 'PAYMENT',
        cadence: 'DAILY',
        minAmountPesewas: 100_000_01,
      }).success,
    ).toBe(false);
    expect(AlertsSettingsUpdate.safeParse({ kind: 'PAYMENT', cadence: 'DAILY' }).success).toBe(
      true,
    );
  });
});
