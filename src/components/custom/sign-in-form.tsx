// Tilo app code.
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn } from '@/lib/auth-client';
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
    const { error: signInError } = isEmail
      ? await signIn.email({ email: identifier.trim(), password })
      : await signIn.phoneNumber({ phoneNumber: toE164(identifier), password });
    setPending(false);
    if (signInError) {
      setError(signInError.message ?? 'Could not sign in. Check your details.');
      return;
    }
    window.location.assign('/dashboard');
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
            or with your phone or email
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
          </div>
        </div>
      ) : null}
      <Label htmlFor="sign-in-identifier">Phone number or email</Label>
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
      />
      <div className="flex items-center justify-between">
        <Label htmlFor="sign-in-password">Password</Label>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
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
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
