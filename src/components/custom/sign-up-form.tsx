// Tilo app code.
'use client';

import { Check, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { SmsNotice } from '@/components/custom/sms-notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient, signIn } from '@/lib/auth-client';
import { env } from '@/lib/env';
import { toE164 } from '@/lib/phone';
import {
  friendlyOtpError,
  OTP_EXPIRY_HINT,
  useResendCooldown,
  useSmsStatus,
} from '@/lib/sms-status-client';

// Phone-first sign-up: name + phone + password (email optional). Nothing is
// created until the SMS code is proven — the custom /phone-number/sign-up
// endpoint verifies the OTP and THEN writes the account. Google accounts
// self-verify.
type Step = 'details' | 'otp';

// Typed shapes for the custom /phone-number/* endpoints. The raw authClient
// $fetch can't infer these, so the responses are annotated below.
type AvailabilityResponse = { available: boolean; reason?: 'phone' | 'email' | 'invite' };

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
  // Known state of the SMS provider. `null` means still probing (or the probe
  // failed) — in that case we let the form submit and surface whatever the send
  // returns rather than block on an unknown.
  const sms = useSmsStatus();
  const smsUnavailable = sms !== null && !sms.configured;
  // Resend is real provider money, so it parks for a minute after each send.
  const { cooldown, startCooldown } = useResendCooldown();

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
      setError(friendlyOtpError(otpError.message));
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
    // Known-unconfigured provider: stop here rather than pay for the
    // check-availability round trip whose OTP send is certain to fail.
    if (smsUnavailable) {
      setError('Text verification is not available on this deployment yet.');
      return;
    }

    setPending(true);
    // Refuse to spend an SMS on a sign-up that won't get through: the backend
    // mirrors the sign-up endpoint's phone + email uniqueness and invite checks.
    const { data, error: availabilityError } = (await authClient.$fetch(
      '/phone-number/check-availability',
      {
        method: 'POST',
        body: {
          phoneNumber: normalized,
          email: email.trim() || undefined,
          inviteCode: inviteCode.trim() || undefined,
        },
      },
    )) as { data: AvailabilityResponse; error: { message?: string } | null };
    if (availabilityError) {
      setPending(false);
      setError(availabilityError.message ?? 'Could not check that phone number. Try again.');
      return;
    }
    if (data && data.available === false) {
      setPending(false);
      if (data.reason === 'invite') {
        setError("That invite code didn't work. Double-check it.");
        return;
      }
      setError(
        data.reason === 'email'
          ? 'That email is already in use. Sign in instead.'
          : 'That phone number is already in use. Sign in instead.',
      );
      return;
    }

    setE164(normalized);
    const sent = await sendCode(normalized);
    setPending(false);
    if (!sent) {
      // sendCode has already set the specific error (e.g. SMS provider failure,
      // rate limit). Don't overwrite it with a generic message that hides what
      // actually went wrong.
      return;
    }
    setStep('otp');
    startCooldown();
    setNotice(`We sent a 6-digit code to ${normalized}. ${OTP_EXPIRY_HINT}`);
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
      setError(friendlyOtpError(signUpError.message));
      return;
    }
    window.location.assign('/dashboard');
  }

  async function resend() {
    if (cooldown > 0) return;
    setError(undefined);
    setPending(true);
    const sent = await sendCode(e164);
    setPending(false);
    if (sent) {
      startCooldown();
      setNotice(`New code sent to ${e164}. ${OTP_EXPIRY_HINT}`);
    }
  }

  return step === 'otp' ? (
    <form onSubmit={handleVerify} className="space-y-4" noValidate>
      <span className="flex items-center justify-center gap-2 text-eyebrow">
        <KeyRound aria-hidden className="size-4" /> One last step
      </span>
      <Label htmlFor="sign-up-code" className="text-small font-medium">
        6-digit code
      </Label>
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
        className="h-11 rounded-md"
      />
      <p className="rounded-lg bg-muted px-4 py-3 text-small text-muted-foreground">
        {notice ?? `We texted a code to ${e164} — enter it to prove the number is yours.`}
      </p>
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-small text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending || code.length < 6}
        className="mt-6 h-11 w-full rounded-md font-semibold"
      >
        {pending ? 'Checking…' : 'Confirm my number'}
      </Button>
      <button
        type="button"
        onClick={() => void resend()}
        disabled={pending || cooldown > 0}
        className="text-small text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:no-underline disabled:opacity-60"
      >
        {cooldown > 0 ? `Resend the code in ${cooldown}s` : 'Resend the code'}
      </button>
    </form>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <SmsNotice />
      {env.NEXT_PUBLIC_GOOGLE_AUTH === 'true' ? (
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="outline"
            disabled={googlePending}
            onClick={() => void handleGoogle()}
            className="h-11 w-full rounded-md"
          >
            {googlePending ? 'Opening Google…' : 'Continue with Google'}
          </Button>
          <div className="flex items-center gap-3 text-small text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or build one with your phone
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      ) : null}
      <Label htmlFor="sign-up-name" className="text-small font-medium">
        Name
      </Label>
      <Input
        id="sign-up-name"
        name="name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
        className="h-11 rounded-md"
      />
      <Label htmlFor="sign-up-phone" className="text-small font-medium">
        Phone number
      </Label>
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
        className="h-11 rounded-md"
      />
      <Label htmlFor="sign-up-email" className="text-small font-medium">
        Email address (optional)
      </Label>
      <Input
        id="sign-up-email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={error ? true : undefined}
        className="h-11 rounded-md"
      />
      {env.NEXT_PUBLIC_SIGNUP_INVITE === 'true' ? (
        <>
          <Label htmlFor="sign-up-invite" className="text-small font-medium">
            Invite code
          </Label>
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
            className="h-11 rounded-md"
          />
        </>
      ) : null}
      <Label htmlFor="sign-up-password" className="text-small font-medium">
        Password
      </Label>
      <Input
        id="sign-up-password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="flex items-center justify-center gap-1 text-center text-small text-muted-foreground">
        <Check aria-hidden className="size-3.5" />
        {smsUnavailable
          ? 'SMS verification is switched off here'
          : 'We\u2019ll text a code to your phone'}
      </p>
    </form>
  );
}
