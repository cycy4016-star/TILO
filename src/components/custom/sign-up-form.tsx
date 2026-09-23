// Tilo app code.
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, signUp } from '@/lib/auth-client';
import { env } from '@/lib/env';
import { toE164 } from '@/lib/phone';

// Phone-first sign-up: name + phone + password (email optional) opens the
// workspace immediately — no SMS OTP. The phone is the primary identity; the
// email is only a convenience and can be added later.
export function SignUpForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

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
    // Better Auth always needs an email; synthesize one when the user skips it.
    const accountEmail = email.trim() || `${normalized.replace(/^\+/, '')}@phone.tilo`;
    const { error: signUpError } = await signUp.email({
      name,
      email: accountEmail,
      password,
      phoneNumber: normalized,
      inviteCode: inviteCode.trim(),
    });
    setPending(false);
    if (signUpError) {
      setError(signUpError.message ?? 'Could not create your account. Try again.');
      return;
    }
    window.location.assign('/dashboard');
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
        {pending ? 'Opening the workspace…' : 'Create account'}
      </Button>
    </form>
  );
}
