// Tilo app code.
'use client';

import { useState } from 'react';
import { SmsNotice } from '@/components/custom/sms-notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { toE164 } from '@/lib/phone';
import { friendlyOtpError, useSmsStatus } from '@/lib/sms-status-client';

type Step = 'phone' | 'reset';

// Password reset over SMS: request an OTP for the account phone, then set a new
// password with it. Email reset only works when an email provider is configured;
// phone is always available.
export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [e164, setE164] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  // `null` = still probing or probe failed; only a definitive "off" blocks.
  const sms = useSmsStatus();
  const smsUnavailable = sms !== null && !sms.configured;

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const normalized = toE164(phone);
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      setError('Enter a valid phone number, e.g. 024 000 0000.');
      return;
    }
    if (smsUnavailable) {
      setError('Password reset by text is not available on this deployment yet.');
      return;
    }
    setPending(true);
    const { error: requestError } = await authClient.phoneNumber.requestPasswordReset({
      phoneNumber: normalized,
    });
    setPending(false);
    if (requestError) {
      setError(friendlyOtpError(requestError.message));
      return;
    }
    setE164(normalized);
    setStep('reset');
    setNotice(`If ${normalized} is a Tilo account, we just texted it a reset code.`);
  }

  async function resetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setPending(true);
    const { error: resetError } = await authClient.phoneNumber.resetPassword({
      phoneNumber: e164,
      otp,
      newPassword: password,
    });
    setPending(false);
    if (resetError) {
      setError(resetError.message ?? 'That code did not work. Try again.');
      return;
    }
    window.location.assign('/login');
  }

  if (step === 'reset') {
    return (
      <form onSubmit={resetPassword} className="space-y-4" noValidate>
        <Label htmlFor="reset-otp" className="text-small font-medium">
          Reset code
        </Label>
        <Input
          id="reset-otp"
          name="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          required
          aria-invalid={error ? true : undefined}
          className="h-11 rounded-md"
        />
        <Label htmlFor="reset-password" className="text-small font-medium">
          New password
        </Label>
        <Input
          id="reset-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-invalid={error ? true : undefined}
          className="h-11 rounded-md"
        />
        <Label htmlFor="reset-confirm" className="text-small font-medium">
          Confirm password
        </Label>
        <Input
          id="reset-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          aria-invalid={error ? true : undefined}
          className="h-11 rounded-md"
        />
        {notice ? (
          <p className="rounded-lg bg-muted px-4 py-3 text-small text-muted-foreground">{notice}</p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-small text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={pending}
          className="mt-6 h-11 w-full rounded-md font-semibold"
        >
          {pending ? 'Saving…' : 'Set new password'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep('phone');
            setError(undefined);
            setNotice(undefined);
          }}
          className="text-small text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Use a different number
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4" noValidate>
      <SmsNotice />
      <Label htmlFor="reset-phone" className="text-small font-medium">
        Phone number
      </Label>
      <Input
        id="reset-phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="024 000 0000"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
        className="h-11 rounded-md"
      />
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-small text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending || smsUnavailable}
        className="mt-6 h-11 w-full rounded-md font-semibold"
      >
        {pending ? 'Sending…' : 'Text me a reset code'}
      </Button>
    </form>
  );
}
