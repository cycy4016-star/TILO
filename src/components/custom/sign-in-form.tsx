// Tilo app code.
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient, signIn } from '@/lib/auth-client';
import { env } from '@/lib/env';
import { toE164 } from '@/lib/phone';

// Email-or-phone + password sign-in (with an optional "or Google" escape hatch).
// Phone is the primary identity for phone-first accounts; users who pick Google
// use their Google-verified email instead. Composes the base shadcn primitives
// styled through the theme tokens. On success the session cookie is set by the
// catch-all route handler and we reload into the workspace. Google requires
// NEXT_PUBLIC_GOOGLE_AUTH=true + GOOGLE_CLIENT_ID/SECRET.
export function SignInForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const isEmail = identifier.includes('@');
    const identifierValue = isEmail ? identifier.trim() : toE164(identifier);
    const { error: signInError } = isEmail
      ? await signIn.email({ email: identifierValue, password })
      : await signIn.phoneNumber({ phoneNumber: identifierValue, password });
    if (signInError) {
      setPending(false);
      // The account exists but its phone was never SMS-proven (older/imported
      // rows, or an OTP that was abandoned mid sign-up). Better Auth already
      // texted an OTP on this attempt, so send them to the /verify ramp to
      // finish proving the number instead of showing a dead-end error.
      if (signInError.code === 'PHONE_NUMBER_NOT_VERIFIED') {
        window.location.assign(`/verify?phone=${encodeURIComponent(identifierValue)}`);
        return;
      }
      setError(signInError.message ?? 'Could not sign in. Check your details.');
      return;
    }
    // Phone-first accounts must have proven their number by SMS. If they never
    // finished the OTP step, send them to the /verify ramp instead of the floor.
    let verified = true;
    const session = await authClient.getSession().catch(() => null);
    if (session?.data?.user) verified = session.data.user.phoneNumberVerified ?? true;
    setPending(false);
    window.location.assign(verified ? '/dashboard' : '/verify');
  }

  async function handleGoogle() {
    setGooglePending(true);
    setError(undefined);
    const { error: googleError } = await signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    });
    if (googleError) {
      setGooglePending(false);
      setError(googleError.message ?? 'Could not start Google sign-in.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
            or with your phone or email
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      ) : null}
      <Label htmlFor="sign-in-identifier" className="text-small font-medium">
        Phone number or email
      </Label>
      <Input
        id="sign-in-identifier"
        name="identifier"
        type="text"
        autoComplete="username"
        placeholder="024 000 0000 or you@example.com"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
        className="h-11 rounded-md"
      />
      <div className="flex items-center justify-between">
        <Label htmlFor="sign-in-password" className="text-small font-medium">
          Password
        </Label>
        <Link
          href="/forgot-password"
          className="text-small text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <Input
        id="sign-in-password"
        name="password"
        type="password"
        autoComplete="current-password"
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
        disabled={pending}
        className="mt-6 h-11 w-full rounded-md font-semibold"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
