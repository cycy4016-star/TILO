// Tilo app code.
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { toE164 } from '@/lib/phone';

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

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const normalized = toE164(phone);
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      setError('Enter a valid phone number, e.g. 024 000 0000.');
      return;
    }
    setPending(true);
    const { error: requestError } = await authClient.phoneNumber.requestPasswordReset({
      phoneNumber: normalized,
    });
    setPending(false);
    if (requestError) {
      setError(requestError.message ?? 'Could not send a reset code. Try again.');
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
      <form onSubmit={resetPassword} className="flex flex-col gap-3" noValidate>
        <Label htmlFor="reset-otp">Reset code</Label>
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
        />
        <Label htmlFor="reset-password">New password</Label>
        <Input
          id="reset-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-invalid={error ? true : undefined}
        />
        <Label htmlFor="reset-confirm">Confirm password</Label>
        <Input
          id="reset-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          aria-invalid={error ? true : undefined}
        />
        {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Saving…' : 'Set new password'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep('phone');
            setError(undefined);
            setNotice(undefined);
          }}
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Use a different number
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="flex flex-col gap-3" noValidate>
      <Label htmlFor="reset-phone">Phone number</Label>
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
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Text me a reset code'}
      </Button>
    </form>
  );
}
