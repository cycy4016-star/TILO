// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DashboardOverview } from '@/lib/contracts/dashboard';
import { toE164, waMeLink } from '@/lib/phone';

describe('phone helpers', () => {
  it('normalises Ghanaian numbers to +233 E.164', () => {
    expect(toE164('0241234567')).toBe('+233241234567');
    expect(toE164('233241234567')).toBe('+233241234567');
    expect(toE164('+233241234567')).toBe('+233241234567');
    expect(toE164('024-123-4567')).toBe('+233241234567');
  });

  it('builds wa.me links for stored numbers and hides chat without one', () => {
    expect(waMeLink('0241234567')).toBe('https://wa.me/233241234567');
    expect(waMeLink('+233 24 123 4567')).toBe('https://wa.me/233241234567');
    expect(waMeLink(null)).toBeNull();
    expect(waMeLink('')).toBeNull();
    expect(waMeLink('123')).toBeNull();
  });
});

describe('dashboard overview contract', () => {
  const overview = {
    outstandingPesewas: 4550,
    outstandingCount: 2,
    oldestOutstandingDays: 3,
    recoveredMonthPesewas: 20000,
    recoveredMonthCount: 4,
    topChases: [
      {
        orderId: 'order-1',
        orderNumber: 'TILO-ABC',
        customerId: 'customer-1',
        customerName: 'Ama',
        customerPhone: '0241234567',
        description: 'Restock',
        amountPesewas: 4550,
        ageDays: 3,
        status: 'PENDING' as const,
      },
    ],
  };

  it('accepts a well-formed overview', () => {
    expect(DashboardOverview.safeParse(overview).success).toBe(true);
  });

  it('rejects a missing strategy row and an unknown status', () => {
    const first = overview.topChases[0];
    if (!first) throw new Error('fixture missing');
    const { customerPhone: _dropped, ...noPhone } = first;
    expect(DashboardOverview.safeParse({ ...overview, topChases: [noPhone] }).success).toBe(false);
    expect(
      DashboardOverview.safeParse({
        ...overview,
        topChases: [{ ...overview.topChases[0], status: 'FROZEN' }],
      }).success,
    ).toBe(false);
  });
});
