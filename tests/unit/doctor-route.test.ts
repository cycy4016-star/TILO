// @vitest-environment node
//
// Doctor route tests: a full examination over mocked infrastructure —
// database, migrations on disk, vault baseline, sign-up gate, owner account,
// incident ledger, photo storage, ledger coverage, email and payments — plus
// the admin gate. Each test moves one dial and expects the doctor to say so.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const gate = vi.hoisted(() => ({ requireAdminUser: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    user: { count: vi.fn(), findUnique: vi.fn() },
    authEvent: { count: vi.fn() },
    appLog: { count: vi.fn(), aggregate: vi.fn() },
  },
}));
const vault = vi.hoisted(() => ({ listWorldSnapshots: vi.fn(), currentWorldCounts: vi.fn() }));
const fsMock = vi.hoisted(() => ({ readdirSync: vi.fn() }));
const envMock = vi.hoisted(() => ({
  env: {
    SIGNUP_LIMIT: undefined as number | undefined,
    ADMIN_EMAIL: 'owner@example.com' as string | undefined,
    EMAIL_PROVIDER: 'none' as string,
    RESEND_API_KEY: undefined as string | undefined,
    PAYSTACK_SECRET_KEY: undefined as string | undefined,
  },
}));

vi.mock('@/lib/require-admin-api', () => gate);
vi.mock('@/lib/db', () => db);
vi.mock('@/lib/vault', () => vault);
vi.mock('node:fs', () => fsMock);
vi.mock('@/lib/env', () => envMock);

const counts = {
  users: 3,
  stores: 3,
  storesActive: 3,
  items: 12,
  orders: 4,
  customers: 2,
  leads: 2,
  feedback: 1,
  signups: 3,
  signins: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
  gate.requireAdminUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });

  envMock.env.SIGNUP_LIMIT = undefined;
  envMock.env.ADMIN_EMAIL = 'owner@example.com';
  envMock.env.EMAIL_PROVIDER = 'none';
  envMock.env.RESEND_API_KEY = undefined;
  envMock.env.PAYSTACK_SECRET_KEY = undefined;

  fsMock.readdirSync.mockReturnValue([
    '20260101000000_init',
    '20261018150155_world_snapshot',
    'migration_lock.toml',
  ]);
  db.prisma.$queryRawUnsafe.mockImplementation((sql: string) => {
    if (sql.includes('migration_name')) {
      return Promise.resolve([
        { migration_name: '20260101000000_init' },
        { migration_name: '20261018150155_world_snapshot' },
      ]);
    }
    if (sql.includes('pg_database_size')) return Promise.resolve([{ bytes: 42_000_000n }]);
    if (sql.includes('octet_length')) return Promise.resolve([{ bytes: 4_000_000n }]);
    return Promise.resolve([{ ok: 1 }]);
  });

  db.prisma.user.count.mockResolvedValue(3);
  db.prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'admin', banned: false });
  db.prisma.authEvent.count.mockResolvedValue(3);
  db.prisma.appLog.count.mockResolvedValue(0);
  db.prisma.appLog.aggregate.mockResolvedValue({ _sum: { count: 0 } });

  vault.listWorldSnapshots.mockResolvedValue([
    {
      id: 'snap-1',
      createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      trigger: 'boot',
      counts,
      bytes: 4000,
      imagesIncluded: true,
    },
  ]);
  vault.currentWorldCounts.mockResolvedValue({ ...counts });
});

async function callDoctor() {
  const { GET } = await import('@/app/api/admin/doctor/route');
  return GET(new Request('http://test/api/admin/doctor'));
}

describe('admin doctor route', () => {
  it('reports ALL SYSTEMS GO when every examination passes', async () => {
    const response = await callDoctor();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe('pass');
    expect(body.failures).toBe(0);
    expect(body.warnings).toBe(0);
    expect(body.passed).toBe(body.checks.length);
    expect(body.checks.map((check: { id: string }) => check.id)).toEqual([
      'db',
      'migrations',
      'vault',
      'signups',
      'owner',
      'incidents',
      'photos',
      'ledger',
      'mail',
      'payments',
    ]);
  });

  it('turns the vault check red when the live world shrank', async () => {
    vault.currentWorldCounts.mockResolvedValue({ ...counts, stores: 0, items: 0 });
    const response = await callDoctor();
    const body = await response.json();

    expect(body.status).toBe('fail');
    const vaultCheck = body.checks.find((check: { id: string }) => check.id === 'vault');
    expect(vaultCheck.status).toBe('fail');
    expect(vaultCheck.summary).toContain('12 catalogue items');
    expect(vaultCheck.summary).toContain('3 storefronts');
    expect(vaultCheck.actions.join(' ')).toContain('vault:restore');
  });

  it('warns when the vault has no baseline yet', async () => {
    vault.listWorldSnapshots.mockResolvedValue([]);
    const response = await callDoctor();
    const body = await response.json();
    const vaultCheck = body.checks.find((check: { id: string }) => check.id === 'vault');
    expect(vaultCheck.status).toBe('warn');
    expect(vaultCheck.actions.join(' ')).toContain('Snapshot now');
  });

  it('warns when sign-up slots are nearly gone, and fails when they are full', async () => {
    envMock.env.SIGNUP_LIMIT = 4;
    const warnBody = await (await callDoctor()).json();
    const warnCheck = warnBody.checks.find((check: { id: string }) => check.id === 'signups');
    expect(warnBody.status).toBe('warn');
    expect(warnCheck.summary).toContain('Only 1 of 4');

    envMock.env.SIGNUP_LIMIT = 3;
    const failBody = await (await callDoctor()).json();
    const failCheck = failBody.checks.find((check: { id: string }) => check.id === 'signups');
    expect(failBody.status).toBe('fail');
    expect(failCheck.summary).toContain('BLOCKED');
    expect(failCheck.actions.join(' ')).toContain('SIGNUP_LIMIT');
  });

  it('fails when the owner email exists but holds no operator role', async () => {
    db.prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'user', banned: false });
    const body = await (await callDoctor()).json();
    const ownerCheck = body.checks.find((check: { id: string }) => check.id === 'owner');
    expect(ownerCheck.status).toBe('fail');
    expect(ownerCheck.summary).toContain('owner@example.com');
  });

  it('warns about open incidents', async () => {
    db.prisma.appLog.count.mockResolvedValue(2);
    db.prisma.appLog.aggregate.mockResolvedValue({ _sum: { count: 9 } });
    const body = await (await callDoctor()).json();
    const incidentCheck = body.checks.find((check: { id: string }) => check.id === 'incidents');
    expect(incidentCheck.status).toBe('warn');
    expect(incidentCheck.summary).toContain('2 incidents are open');
  });

  it('fails when email is switched on without a key', async () => {
    envMock.env.EMAIL_PROVIDER = 'resend';
    const body = await (await callDoctor()).json();
    const mailCheck = body.checks.find((check: { id: string }) => check.id === 'mail');
    expect(mailCheck.status).toBe('fail');
    expect(mailCheck.actions.join(' ')).toContain('RESEND_API_KEY');
  });

  it('survives a crashing check — the crash becomes that check’s fault', async () => {
    db.prisma.appLog.count.mockRejectedValue(new Error('ledger table missing'));
    const response = await callDoctor();
    expect(response.status).toBe(200);
    const body = await response.json();
    const incidentCheck = body.checks.find((check: { id: string }) => check.id === 'incidents');
    expect(incidentCheck.status).toBe('fail');
    expect(incidentCheck.detail).toContain('ledger table missing');
    // The other checks still ran and the report still rendered.
    expect(body.checks).toHaveLength(10);
  });

  it('stays behind the admin gate', async () => {
    gate.requireAdminUser.mockRejectedValueOnce(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );
    const response = await callDoctor();
    expect(response.status).toBe(403);
  });
});
