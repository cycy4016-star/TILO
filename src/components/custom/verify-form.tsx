// Rescue ramp for an interrupted sign-up. Your account exists but the OTP
// was never confirmed (or was abandoned), and the workspace stays locked
// until a phone is SMS-verified. This page lets you finish the job and roll on.
'use client';

import { Check, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { toE164 } from '@/lib/phone';

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
    prefilled ? `We just texted a code to ${prefilled}.` : undefined,
  );

  async function handlePhone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const normalized = toE164(phone);
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      setError('Enter a valid phone number, e.g. 024 000 0000.');
      return;
    }
    setPending(true);
    const { error: otpError } = await authClient.phoneNumber.sendOtp({
      phoneNumber: normalized,
    });
    setPending(false);
    if (otpError) {
      setError(otpError.message ?? 'The code did not send. Try again.');
      return;
    }
    setE164(normalized);
    setStep('otp');
    setNotice(`We sent a 6-digit code to ${normalized}.`);
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
      setError(verifyError.message ?? 'That code did not work. Try again.');
      return;
    }
    setStep('done');
  }

  async function resend() {
    setError(undefined);
    setPending(true);
    const { error: otpError } = await authClient.phoneNumber.sendOtp({ phoneNumber: e164 });
    setPending(false);
    if (otpError) {
      setError(otpError.message ?? 'Could not resend the code.');
      return;
    }
    setNotice(`New code sent to ${e164}.`);
  }

  if (step === 'done') {
    return (
      <div className="grid gap-4 text-center">
        <span className="mx-auto flex size-14 -rotate-6 items-center justify-center rounded-3xl bg-emerald-600 text-white">
          <Check aria-hidden className="size-6" />
        </span>
        <p className="font-display text-2xl font-black uppercase">You&apos;re in</p>
        <p className="text-sm font-medium text-stone-500">
          The door&apos;s unlocked. Rolling you to the dashboard…
        </p>
        <Button
          type="button"
          onClick={() => router.replace('/dashboard')}
          className="rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
        >
          To the floor
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={step === 'phone' ? handlePhone : handleVerify}
      className="flex flex-col gap-3"
      noValidate
    >
      {step === 'phone' ? (
        <>
          <Label htmlFor="verify-phone">Your phone number</Label>
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
            className="h-12 rounded-2xl"
          />
        </>
      ) : (
        <>
          <Label htmlFor="verify-code">6-digit code</Label>
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
            className="h-12 rounded-2xl"
          />
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        </>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        disabled={pending || (step === 'otp' && code.length < 6)}
        className="h-12 w-full"
      >
        {pending ? 'Working…' : step === 'phone' ? 'Send the code' : 'Confirm my number'}
      </Button>
      {step === 'otp' ? (
        <>
          <button
            type="button"
            onClick={resend}
            disabled={pending}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Resend the code
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
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Use a different number
          </button>
        </>
      ) : null}
      <p className="flex items-center justify-center gap-1 text-center text-xs font-bold uppercase tracking-widest text-stone-400">
        <KeyRound aria-hidden className="size-3.5" /> Unlocks your whole floor
      </p>
    </form>
  );
}
