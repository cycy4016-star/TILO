// Wire-shape contracts for the live-orders milestone: the public storefront
// captures (order + lead) and the SMS composer/routes.
import { describe, expect, it } from 'vitest';
import { NotificationFeed, NotificationKind } from '@/lib/contracts/notification';
import { PublicLeadCreate, PublicOrderCreate } from '@/lib/contracts/public-store';
import { SmsDispatch, SmsUsageOverview } from '@/lib/contracts/sms';

describe('public-store contracts', () => {
  it('accepts a valid storefront order', () => {
    const result = PublicOrderCreate.safeParse({
      itemId: 'item-1',
      quantity: 2,
      customerName: 'Ama',
      phone: '024 111 2200',
      note: '  ',
    });
    expect(result.success).toBe(true);
  });

  it('defaults quantity to one', () => {
    const result = PublicOrderCreate.parse({
      itemId: 'item-1',
      customerName: 'Ama',
      phone: '024 111 2200',
    });
    expect(result.quantity).toBe(1);
  });

  it('rejects surly quantities', () => {
    expect(
      PublicOrderCreate.safeParse({ itemId: 'x', quantity: 0, customerName: 'Ama', phone: 'p' })
        .success,
    ).toBe(false);
    expect(
      PublicOrderCreate.safeParse({ itemId: 'x', quantity: 100, customerName: 'Ama', phone: 'p' })
        .success,
    ).toBe(false);
  });

  it('requires a phone and name for a lead', () => {
    expect(PublicLeadCreate.safeParse({ name: 'Ama', phone: '' }).success).toBe(false);
    expect(PublicLeadCreate.safeParse({ name: '', phone: '024 111 2200' }).success).toBe(false);
  });

  it('only saves a lead when the visitor consented', () => {
    const withConsent = PublicLeadCreate.safeParse({
      name: 'Ama',
      phone: '024 111 2200',
      consent: true,
    });
    expect(withConsent.success).toBe(true);
    const withoutConsent = PublicLeadCreate.safeParse({
      name: 'Ama',
      phone: '024 111 2200',
      consent: false,
    });
    expect(withoutConsent.success).toBe(false);
    if (!withoutConsent.success) {
      expect(withoutConsent.error.flatten().fieldErrors.consent?.[0]).toContain('Tick the box');
    }
  });
});

describe('sms contracts', () => {
  it('caps manual sends at one low-cost message', () => {
    const ok = SmsDispatch.safeParse({ to: '024 111 2200', message: 'Short and sweet' });
    expect(ok.success).toBe(true);
    const oversized = SmsDispatch.safeParse({ to: '024', message: 'x'.repeat(321) });
    expect(oversized.success).toBe(false);
    if (!oversized.success) {
      expect(oversized.error.flatten().fieldErrors.message?.[0]).toMatch(/320/);
    }
    const empty = SmsDispatch.safeParse({ to: '024', message: '   ' });
    expect(empty.success).toBe(false);
  });

  it('parses the ledger overview shape', () => {
    const parsed = SmsUsageOverview.parse({
      monthSent: 12,
      monthFailed: 1,
      monthCredits: 14,
      monthEstimatedCostPesewas: 700,
      allTimeSent: 120,
      allTimeCredits: 130,
      bySource: [{ source: 'MANUAL', sent: 2, credits: 2 }],
      recent: [
        {
          id: 'log-1',
          to: '+233241112200',
          source: 'OTP',
          credits: 1,
          ok: true,
          createdAt: '2026-09-22T00:00:00.000Z',
        },
      ],
    });
    expect(parsed.monthSent).toBe(12);
    expect(parsed.bySource[0]?.source).toBe('MANUAL');
    expect(
      SmsUsageOverview.safeParse({
        ...parsed,
        bySource: [{ source: 'BOGUS', sent: 0, credits: 0 }],
      }).success,
    ).toBe(false);
  });

  it('shapes notifications the way the bell expects', () => {
    const feed = NotificationFeed.parse({
      unreadCount: 1,
      items: [
        {
          id: 'n-1',
          kind: 'ORDER_PLACED',
          title: 'New order — Apron',
          message: null,
          customerId: 'customer-1',
          orderId: null,
          readAt: null,
          createdAt: '2026-09-22T00:00:00.000Z',
          updatedAt: '2026-09-22T00:00:00.000Z',
        },
      ],
    });
    expect(feed.unreadCount).toBe(1);
    expect(NotificationKind.safeParse('SMS_SENT').success).toBe(true);
    expect(NotificationKind.safeParse('WAT').success).toBe(false);
    expect(NotificationFeed.safeParse({ unreadCount: -1, items: [] }).success).toBe(false);
  });
});
