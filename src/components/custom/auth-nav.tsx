// Tilo sign-in / sign-out cluster for the public header.
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

interface AuthNavProps {
  // `inline` = the compact horizontal cluster for the desktop header.
  // `stack` = full-width rows for the mobile sheet, with big touch targets.
  variant?: 'inline' | 'stack';
  onNavigate?: () => void;
}

export function AuthNav({ variant = 'inline', onNavigate }: AuthNavProps) {
  const { data: session, isPending } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  // Render nothing until the session resolves — avoids a Sign-in→Profile flash.
  if (isPending) return null;

  const navClass = cn(
    'flex items-center gap-2',
    variant === 'stack' && 'w-full flex-col items-stretch',
  );
  const buttonClass = variant === 'stack' ? 'h-11 w-full' : undefined;

  if (!session?.user) {
    return (
      <nav className={navClass}>
        <Button asChild variant="ghost" className={buttonClass}>
          <a href="/login" onClick={onNavigate}>
            Sign in
          </a>
        </Button>
        <Button asChild className={buttonClass}>
          <a href="/signup" onClick={onNavigate}>
            Sign up
          </a>
        </Button>
      </nav>
    );
  }

  return (
    <nav className={navClass}>
      <Button asChild variant="ghost" className={buttonClass}>
        <a href="/profile" onClick={onNavigate}>
          Profile
        </a>
      </Button>
      <Button
        variant="secondary"
        className={buttonClass}
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
