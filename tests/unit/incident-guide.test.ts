import { describe, expect, it } from 'vitest';
import { incidentGuide } from '@/lib/incident-guide';

describe('incident guide', () => {
  it('reads a database failure as a database problem, whatever the route', () => {
    const guide = incidentGuide({
      message: "Can't reach database server at localhost:5432",
      route: '/api/store',
      source: 'SERVER',
    });
    expect(guide.area).toBe('DB');
    expect(guide.steps.join(' ')).toContain('DOCTOR');
  });

  it('reads auth routes as a sign-in step', () => {
    const guide = incidentGuide({
      message: 'Callback state mismatch',
      route: '/api/auth/callback/google',
      source: 'SERVER',
    });
    expect(guide.area).toBe('SIGN-IN');
  });

  it('reads image failures as photo problems', () => {
    const guide = incidentGuide({
      message: 'Input buffer has unsupported image format',
      route: '/api/uploads',
      source: 'SERVER',
    });
    expect(guide.area).toBe('PHOTOS');
  });

  it('reads Paystack failures as payment problems', () => {
    const guide = incidentGuide({
      message: 'Paystack init failed with 401',
      route: '/api/orders',
      source: 'SERVER',
    });
    expect(guide.area).toBe('PAYMENTS');
  });

  it('reads SMS failures as message problems', () => {
    const guide = incidentGuide({
      message: 'SMS gateway rejected the request',
      route: '/api/sms/send',
      source: 'SERVER',
    });
    expect(guide.area).toBe('MESSAGES');
  });

  it('reads shop-editor routes as a save that did not go through', () => {
    const guide = incidentGuide({
      message: 'Validation failed',
      route: '/api/promotions',
      source: 'SERVER',
    });
    expect(guide.area).toBe('SHOP');
  });

  it('falls back to the browser guide for client-sourced failures', () => {
    const guide = incidentGuide({
      message: 'Unexpected token < in JSON',
      route: '/dashboard/store',
      source: 'CLIENT',
    });
    expect(guide.area).toBe('BROWSER');
  });

  it('is honest when it recognises nothing', () => {
    const guide = incidentGuide({
      message: 'Unexpected token < in JSON',
      route: '/dashboard/store',
      source: 'SERVER',
    });
    expect(guide.area).toBe('UNKNOWN');
    expect(guide.steps.join(' ')).toContain('DOCTOR');
  });

  it('gives every guide a headline, an explanation and real steps', () => {
    const samples = [
      { message: 'prisma p1001', route: '/api/store', source: 'SERVER' },
      { message: 'auth', route: '/api/auth/sign-in', source: 'SERVER' },
      { message: 'image', route: '/api/uploads', source: 'SERVER' },
      { message: 'paystack', route: '/api/orders', source: 'SERVER' },
      { message: 'sms', route: '/api/sms/send', source: 'SERVER' },
      { message: 'validation', route: '/api/products', source: 'SERVER' },
      { message: 'boom', route: '/x', source: 'CLIENT' },
      { message: 'boom', route: '/x', source: 'SERVER' },
    ];
    for (const sample of samples) {
      const guide = incidentGuide(sample);
      expect(guide.title.length).toBeGreaterThan(8);
      expect(guide.what.length).toBeGreaterThan(40);
      expect(guide.steps.length).toBeGreaterThanOrEqual(3);
    }
  });
});
