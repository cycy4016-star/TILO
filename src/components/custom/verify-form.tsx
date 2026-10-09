// Rescue ramp for an interrupted sign-up. Your account exists but the OTP
// was never confirmed (or was abandoned), and the workspace stays locked
// until a phone is SMS-verified. This page lets you finish the job and roll on.
'use client';

import { Check, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SmsNotice } from '@/components/custom/sms-notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { toE164 } from '@/lib/phone';
import {
  friendlyOtpError,
  OTP_EXPIRY_HINT,
  RESEND_COOLDOWN_SECONDS,
  useResendCooldown,
  useSmsStatus,
} from '@/lib/sms-status-client';

type Step = 'phone' | 'otp' | 'done';

// `initialPhone` is set when the handler bounced here from a phone sign-in that
// failed with PHONE_NUMBER_NOT_VERIFIED: better-auth had already texted an OTP
// for that number, so the ramp lands straight on the code step instead of
// double-sending.
export function VerifyForm({ initialPhone }: { initialPhone?: string }) {
  const router = useRouter();
  const prefilled = initialPhone ? toE164(initialPhone) : null;
  const [step, setStep] = useState<Step>(prefilled ? 'otp' : 'phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [e164, setE164] = useState(prefilled ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(
    prefilled ? `We just texted a code to ${prefilled}. ${OTP_EXPIRY_HINT}` : undefined,
  );
  // `null` = still probing (or probe failed). Only a definitive "off" blocks a
  // send — an unknown must not lock someone out of the rescue ramp.
  const sms = useSmsStatus();
  const smsUnavailable = sms !== null && !sms.configured;
  const { cooldown, startCooldown } = useResendCooldown(
    // Bounced here straight from sign-in: better-auth already texted a code for
    // this number, so the resend button parks just like a fresh send.
    prefilled ? RESEND_COOLDOWN_SECONDS : 0,
  );

  async function handlePhone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const normalized = toE164(phone);
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      setError('Enter a valid phone number, e.g. 024 000 0000.');
      return;
    }
    if (smsUnavailable) {
      setError('Text verification is not available on this deployment yet.');
      return;
    }
    setPending(true);
    const { error: otpError } = await authClient.phoneNumber.sendOtp({
      phoneNumber: normalized,
    });
    setPending(false);
    if (otpError) {
      setError(friendlyOtpError(otpError.message));
      return;
    }
    setE164(normalized);
    setStep('otp');
    startCooldown();
    setNotice(`We sent a 6-digit code to ${normalized}. ${OTP_EXPIRY_HINT}`);
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    // Two rescue cases feed this page:
    //  - Signed in but with an unverified phone (e.g. a Google account adding a
    //    number): verify + update the session user's own row.
    //  - Signed out with an existing-but-unverified account (older/imported
    //    rows): verify WITHOUT `updatePhoneNumber` — the phone plugin looks the
    //    user up by number, marks it verified, and opens a fresh session. With
    //    `updatePhoneNumber: true` the plugin instead requires a live session
    //    (getSessionFromCtx) and would reject a signed-out user outright.
    const { data: session } = await authClient.getSession().catch(() => ({ data: null }));
    const { error: verifyError } = await authClient.phoneNumber.verify({
      phoneNumber: e164,
      code,
      updatePhoneNumber: Boolean(session?.session),
    });
    setPending(false);
    if (verifyError) {
      setError(friendlyOtpError(verifyError.message));
      return;
    }
    setStep('done');
  }

  async function resend() {
    if (cooldown > 0) return;
    setError(undefined);
    setPending(true);
    const { error: otpError } = await authClient.phoneNumber.sendOtp({ phoneNumber: e164 });
    setPending(false);
    if (otpError) {
      setError(friendlyOtpError(otpError.message));
      return;
    }
    startCooldown();
    setNotice(`New code sent to ${e164}. ${OTP_EXPIRY_HINT}`);
  }

  if (step === 'done') {
    return (
      <div className="grid gap-4 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Check aria-hidden className="size-6" />
        </span>
        <p className="text-h2">You&apos;re verified</p>
        <p className="text-small text-muted-foreground">
          Your account is confirmed. Taking you to the dashboard…
        </p>
        <Button
          type="button"
          onClick={() => router.replace('/dashboard')}
          className="h-11 w-full rounded-md font-semibold"
        >
          Go to dashboard
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={step === 'phone' ? handlePhone : handleVerify} className="space-y-4" noValidate>
      {step === 'phone' ? (
        <>
          <SmsNotice />
          <Label htmlFor="verify-phone" className="text-small font-medium">
            Your phone number
          </Label>
          <Input
            id="verify-phone"
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
        </>
      ) : (
        <>
          <Label htmlFor="verify-code" className="text-small font-medium">
            6-digit code
          </Label>
          <Input
            id="verify-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            aria-invalid={error ? true : undefined}
            className="h-11 rounded-md"
          />
          {notice ? (
            <p className="rounded-lg bg-muted px-4 py-3 text-small text-muted-foreground">
              {notice}
            </p>
          ) : null}
        </>
      )}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-small text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={
          pending || (step === 'otp' && code.length < 6) || (step === 'phone' && smsUnavailable)
        }
        className="mt-6 h-11 w-full rounded-md font-semibold"
      >
        {pending ? 'Working…' : step === 'phone' ? 'Send the code' : 'Confirm my number'}
      </Button>
      {step === 'otp' ? (
        <>
          <button
            type="button"
            onClick={resend}
            disabled={pending || cooldown > 0}
            className="text-small text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:no-underline disabled:opacity-60"
          >
            {cooldown > 0 ? `Resend the code in ${cooldown}s` : 'Resend the code'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPhone('');
              setCode('');
              setE164('');
              setNotice(undefined);
              setError(undefined);
              setStep('phone');
            }}
            className="text-small text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Use a different number
          </button>
        </>
      ) : null}
      <p className="flex items-center justify-center gap-1 text-center text-small text-muted-foreground">
        <KeyRound aria-hidden className="size-3.5" /> Unlocks your whole workspace
      </p>
    </form>
  );
}
