// Tilo app code.
'use client';

import { Check, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient, signIn } from '@/lib/auth-client';
import { env } from '@/lib/env';
import { toE164 } from '@/lib/phone';

// Phone-first sign-up: name + phone + password (email optional). Nothing is
// created until the SMS code is proven — the custom /phone-number/sign-up
// endpoint verifies the OTP and THEN writes the account. Google accounts
// self-verify.
type Step = 'details' | 'otp';

// Typed shapes for the custom /phone-number/* endpoints. The raw authClient
// $fetch can't infer these, so the responses are annotated below.
type AvailabilityResponse = { available: boolean; reason?: 'phone' | 'email' };

export function SignUpForm() {
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [e164, setE164] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);

  async function handleGoogle() {
    setGooglePending(true);
    setError(undefined);
    const { error: googleError } = await signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    });
    if (googleError) {
      setGooglePending(false);
      setError(googleError.message ?? 'Could not start Google sign-up.');
    }
  }

  async function sendCode(target: string) {
    setNotice(undefined);
    const { error: otpError } = await authClient.phoneNumber.sendOtp({
      phoneNumber: target,
    });
    if (otpError) {
      setError(otpError.message ?? 'The code did not send. Try again.');
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const normalized = toE164(phone);
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      setError('Enter a valid phone number, e.g. 024 000 0000.');
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('That email address looks off.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (env.NEXT_PUBLIC_SIGNUP_INVITE === 'true' && !inviteCode.trim()) {
      setError('Enter the invite code to join.');
      return;
    }

    setPending(true);
    // Refuse to spend an SMS on a phone/email that's already taken: the
    // backend mirrors the sign-up endpoint's uniqueness + invite checks.
    const { data, error: availabilityError } = (await authClient.$fetch(
      '/phone-number/check-availability',
      {
        method: 'POST',
        body: { phoneNumber: normalized, email: email.trim() || undefined },
      },
    )) as { data: AvailabilityResponse; error: { message?: string } | null };
    if (availabilityError) {
      setPending(false);
      setError(availabilityError.message ?? 'Could not check that phone number. Try again.');
      return;
    }
    if (data && data.available === false) {
      setPending(false);
      const blockReason = data.reason === 'email' ? 'email' : 'phone';
      setError(
        blockReason === 'email'
          ? 'That email is already in use. Sign in instead.'
          : 'That phone number is already in use. Sign in instead.',
      );
      return;
    }

    setE164(normalized);
    const sent = await sendCode(normalized);
    setPending(false);
    if (!sent) {
      setError('The SMS code did not send. Try again.');
      return;
    }
    setStep('otp');
    setNotice(`We sent a 6-digit code to ${normalized}.`);
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    // One call: proves the code AND creates the account (only after the OTP is
    // verified) via the custom /phone-number/sign-up endpoint.
    const accountEmail = email.trim() || undefined;
    const { error: signUpError } = await authClient.$fetch('/phone-number/sign-up', {
      method: 'POST',
      body: {
        name,
        email: accountEmail,
        password,
        phoneNumber: e164,
        inviteCode: inviteCode.trim() || undefined,
        code,
      },
    });
    setPending(false);
    if (signUpError) {
      setError(signUpError.message ?? 'That code did not work. Try again.');
      return;
    }
    window.location.assign('/dashboard');
  }

  async function resend() {
    setError(undefined);
    setPending(true);
    const sent = await sendCode(e164);
    setPending(false);
    if (sent) setNotice(`New code sent to ${e164}.`);
  }

  return step === 'otp' ? (
    <form onSubmit={handleVerify} className="flex flex-col gap-3" noValidate>
      <span className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-amber-600">
        <KeyRound aria-hidden className="size-4" /> One last step
      </span>
      <Label htmlFor="sign-up-code">6-digit code</Label>
      <Input
        id="sign-up-code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        required
        aria-invalid={error ? true : undefined}
      />
      <p className="text-sm text-muted-foreground">
        {notice ?? `We texted a code to ${e164} — enter it to prove the number is yours.`}
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || code.length < 6} className="w-full">
        {pending ? 'Checking…' : 'Confirm my number'}
      </Button>
      <button
        type="button"
        onClick={() => void resend()}
        disabled={pending}
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
      >
        Resend the code
      </button>
    </form>
  ) : (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      {env.NEXT_PUBLIC_GOOGLE_AUTH === 'true' ? (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={googlePending}
            onClick={() => void handleGoogle()}
            className="w-full"
          >
            {googlePending ? 'Opening Google…' : 'Continue with Google'}
          </Button>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-400">
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
            or build one with your phone
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
          </div>
        </div>
      ) : null}
      <Label htmlFor="sign-up-name">Name</Label>
      <Input
        id="sign-up-name"
        name="name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
      />
      <Label htmlFor="sign-up-phone">Phone number</Label>
      <Input
        id="sign-up-phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="024 000 0000"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
      />
      <Label htmlFor="sign-up-email">Email address (optional)</Label>
      <Input
        id="sign-up-email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={error ? true : undefined}
      />
      {env.NEXT_PUBLIC_SIGNUP_INVITE === 'true' ? (
        <>
          <Label htmlFor="sign-up-invite">Invite code</Label>
          <Input
            id="sign-up-invite"
            name="inviteCode"
            type="text"
            autoComplete="off"
            placeholder="Paste your invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
            aria-invalid={error ? true : undefined}
          />
        </>
      ) : null}
      <Label htmlFor="sign-up-password">Password</Label>
      <Input
        id="sign-up-password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="flex items-center justify-center gap-1 text-center text-xs font-bold uppercase tracking-widest text-stone-400">
        <Check aria-hidden className="size-3.5" /> We&apos;ll text a code to your phone
      </p>
    </form>
  );
}
