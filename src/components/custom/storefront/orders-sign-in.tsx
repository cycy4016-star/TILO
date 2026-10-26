'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth-client';

export function OrdersSignIn({ googleEnabled }: { googleEnabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setPending(true);
    setError(null);
    const { error: signInError } = await signIn.social({
      provider: 'google',
      callbackURL: '/orders',
    });
    if (signInError) {
      setPending(false);
      setError(signInError.message ?? 'Could not start Google sign-in.');
    }
  }

  if (!googleEnabled) {
    return (
      <p className="rounded-lg border border-border bg-muted/40 p-4 text-small text-muted-foreground">
        Sign-in is not configured on this deployment. Open the tracking link from your receipt to
        view an order.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <Button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={pending}
        className="h-11 font-semibold"
      >
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Continue with Google
      </Button>
      {error ? (
        <p role="alert" className="text-caption font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
