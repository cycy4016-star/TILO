// Tilza app code.
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn } from '@/lib/auth-client';
import { env } from '@/lib/env';

// Sign-in: Google OAuth (the primary identity) plus an email + password fallback
// for existing credential accounts. Account *creation* is Google-only (see
// auth-config.ts disableSignUp), so the fallback exists purely to keep older
// accounts and the local/e2e harness usable. The session cookie is set by the
// catch-all route handler and we reload into the workspace. Google requires
// NEXT_PUBLIC_GOOGLE_AUTH=true + GOOGLE_CLIENT_ID/SECRET.
export function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const googleEnabled = env.NEXT_PUBLIC_GOOGLE_AUTH === 'true';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const { error: signInError } = await signIn.email({ email: email.trim(), password });
    if (signInError) {
      setPending(false);
      setError(signInError.message ?? 'Could not sign in. Check your details.');
      return;
    }
    setPending(false);
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
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {googleEnabled ? (
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
          <div className="flex items-center gap-3 text-center text-small text-muted-foreground">
            <span className="h-px min-w-8 flex-1 bg-border" />
            <span className="shrink-0 whitespace-nowrap">or with your email</span>
            <span className="h-px min-w-8 flex-1 bg-border" />
          </div>
        </div>
      ) : null}
      <Label htmlFor="sign-in-email" className="text-small font-medium">
        Email
      </Label>
      <Input
        id="sign-in-email"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
        className="h-11 rounded-md"
      />
      <Label htmlFor="sign-in-password" className="text-small font-medium">
        Password
      </Label>
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
