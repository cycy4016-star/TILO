import { describe, expect, it } from 'vitest';
import {
  friendlyOtpError,
  OTP_EXPIRY_HINT,
  RESEND_COOLDOWN_SECONDS,
} from '@/lib/sms-status-client';

describe('friendlyOtpError', () => {
  it('maps a wrong code to a retry hint', () => {
    expect(friendlyOtpError('Invalid OTP')).toContain("doesn't match");
    expect(friendlyOtpError('INVALID_OTP')).toContain("doesn't match");
  });

  it('tells spent attempts to request a fresh code, not to wait', () => {
    expect(friendlyOtpError('Too many attempts')).toContain('fresh one');
    expect(friendlyOtpError('TOO_MANY_ATTEMPTS')).toContain('fresh one');
  });

  it('maps a missing OTP record to a resend hint', () => {
    expect(friendlyOtpError('OTP not found')).toContain('Request a new one');
  });

  it('maps expiry to a resend hint', () => {
    expect(friendlyOtpError('OTP expired')).toContain('expired');
  });

  it('keeps rate-limit advice for actual rate limits', () => {
    expect(friendlyOtpError('Rate limit exceeded, retry in 40s')).toContain('Wait a minute');
  });

  it('passes specific messages through untouched', () => {
    expect(friendlyOtpError("That invite code didn't work. Try again.")).toContain('invite code');
  });

  it('never returns blank copy', () => {
    expect(friendlyOtpError(undefined).length).toBeGreaterThan(0);
    expect(friendlyOtpError('   ').length).toBeGreaterThan(0);
  });
});

describe('otp resend policy', () => {
  it('parks resend for a full minute and names the 5-minute expiry', () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
    expect(OTP_EXPIRY_HINT).toContain('5 minutes');
  });
});
