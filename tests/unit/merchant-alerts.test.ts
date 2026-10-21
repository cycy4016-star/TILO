// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/email', () => mail);
vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

import { sendOrderAlert, sendWeeklyDigest } from '@/lib/merchant-alerts';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test';
  process.env.NEXT_PUBLIC_APP_URL = 'https://tilza.test';
  mail.sendEmail.mockResolvedValue({ ok: true, providerRef: 'mail-1', error: null });
  db.prisma.user.findUnique.mockResolvedValue({
    email: 'owner@example.test',
    name: 'Ama',
  });
});

afterEach(() => {
  delete process.env.EMAIL_PROVIDER;
  delete process.env.RESEND_API_KEY;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe('merchant email alerts', () => {
  it('emails the owner with the order and any low-stock warning', async () => {
    await sendOrderAlert({
      userId: 'owner-1',
      storeName: 'Kente Kitchen',
      orderNumber: 'TILZA-20261021-ABC12345',
      customerName: 'Akosua',
      customerPhone: '+233241112200',
      amountPesewas: 45000,
      lines: [{ name: 'Kente scarf', quantity: 1 }],
      lowStock: [{ name: 'Kente scarf', stock: 1 }],
    });

    expect(mail.sendEmail).toHaveBeenCalledOnce();
    const sent = mail.sendEmail.mock.calls[0]?.[0];
    expect(sent).toBeDefined();
    if (!sent) return;
    expect(sent.to).toBe('owner@example.test');
    expect(sent.subject).toContain('TILZA-20261021-ABC12345');
    expect(sent.text).toContain('Akosua');
    expect(sent.text).toContain('Kente scarf: 1 left');
    expect(sent.text).toContain('https://tilza.test/dashboard/orders');
  });

  it('does nothing when the email provider is not configured', async () => {
    delete process.env.EMAIL_PROVIDER;
    await sendOrderAlert({
      userId: 'owner-1',
      storeName: 'Kente Kitchen',
      orderNumber: 'TILZA-20261021-ABC12345',
      customerName: 'Akosua',
      customerPhone: '+233241112200',
      amountPesewas: 45000,
      lines: [{ name: 'Kente scarf', quantity: 1 }],
      lowStock: [],
    });
    expect(db.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it('sends a weekly digest and reports success', async () => {
    const sent = await sendWeeklyDigest({
      to: 'owner@example.test',
      ownerName: 'Ama',
      storeName: 'Kente Kitchen',
      orderCount: 4,
      revenuePesewas: 120000,
      newCustomers: 2,
      lowStock: [],
    });

    expect(sent).toBe(true);
    expect(mail.sendEmail).toHaveBeenCalledOnce();
    const email = mail.sendEmail.mock.calls[0]?.[0];
    expect(email).toBeDefined();
    if (!email) return;
    expect(email.subject).toContain('4 orders');
    expect(email.text).toContain('Recorded sales');
    expect(email.text).toContain('New customers: 2');
  });
});
