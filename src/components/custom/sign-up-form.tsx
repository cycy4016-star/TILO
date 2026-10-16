// Tilo app code.
'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth-client';
import { env } from '@/lib/env';

// Google-only sign-up. Nothing is collected up front and no phone/OTP step is
// involved — the account is created on the first successful Google sign-in, and
// the Google-verified email is trusted as-is.
export function SignUpForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const googleEnabled = env.NEXT_PUBLIC_GOOGLE_AUTH === 'true';

  async function handleGoogle() {
    setPending(true);
    setError(undefined);
    const { error: googleError } = await signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    });
    if (googleError) {
      setPending(false);
      setError(googleError.message ?? 'Could not start Google sign-up.');
    }
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        disabled={pending || !googleEnabled}
        onClick={() => void handleGoogle()}
        className="h-11 w-full rounded-md"
      >
        {pending ? 'Opening Google…' : 'Continue with Google'}
      </Button>
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-small text-destructive">
          {error}
        </p>
      ) : null}
      {!googleEnabled ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-small text-destructive">
          Google sign-up isn&apos;t set up on this deployment yet.
        </p>
      ) : null}
      <p className="flex items-center justify-center gap-1 text-center text-small text-muted-foreground">
        <Check aria-hidden className="size-3.5" />
        Your Google account creates your shop — setup takes a minute
      </p>
    </div>
  );
}
