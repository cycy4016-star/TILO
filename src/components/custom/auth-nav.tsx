// Tilo sign-in / sign-out cluster for the public header.
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from '@/lib/auth-client';

export function AuthNav() {
  const { data: session, isPending } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  // Render nothing until the session resolves — avoids a Sign-in→Profile flash.
  if (isPending) return null;

  if (!session?.user) {
    return (
      <nav className="flex items-center gap-2">
        <Button asChild variant="ghost">
          <a href="/login">Sign in</a>
        </Button>
        <Button asChild>
          <a href="/signup">Sign up</a>
        </Button>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-2">
      <Button asChild variant="ghost">
        <a href="/profile">Profile</a>
      </Button>
      <Button
        variant="secondary"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          try {
            await signOut();
            window.location.assign('/');
          } finally {
            setSigningOut(false);
          }
        }}
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </nav>
  );
}
