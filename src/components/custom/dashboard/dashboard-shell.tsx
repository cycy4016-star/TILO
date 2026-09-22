// Tilo app code.
'use client';

import { Flame } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from '@/lib/auth-client';
import { NotificationBell } from '../notification-bell';
import { DashboardNav } from './dashboard-nav';

export interface DashboardShellProps {
  children: ReactNode;
}

function hasRole(role: string | null | undefined, expected: string) {
  return (
    role
      ?.split(',')
      .map((item) => item.trim())
      .includes(expected) ?? false
  );
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const isAdmin = hasRole(session?.user?.role, 'admin');

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace('/login');
      return;
    }
    // An interrupted sign-up leaves a session without any verified identity;
    // every workspace call 403s until they finish the OTP ramp.
    if (
      !isPending &&
      session?.user &&
      !session.user.phoneNumberVerified &&
      !session.user.emailVerified
    ) {
      router.replace('/verify');
    }
  }, [isPending, router, session?.user]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } finally {
      setSigningOut(false);
    }
  }

  if (isPending) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#fffbeb] px-5 dark:bg-stone-950">
        <p className="animate-pulse font-display text-sm font-black uppercase tracking-[0.25em] text-yellow-600">
          Warming up…
        </p>
      </main>
    );
  }

  if (!session?.user) {
    // The effect above redirects to /login; this is the brief transition state,
    // not a stable screen.
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#fffbeb] px-5 dark:bg-stone-950">
        <p className="font-display text-sm font-black uppercase tracking-[0.25em] text-yellow-600">
          Rolling to sign in…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#fffbeb] text-stone-900 dark:bg-stone-950 dark:text-amber-50">
      <div className="border-b-4 border-amber-950 bg-amber-300">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 -rotate-6 items-center justify-center rounded-xl bg-amber-950 text-amber-300">
              <Flame aria-hidden="true" className="size-4" />
            </span>
            <span className="truncate font-display text-lg font-black uppercase tracking-tight text-amber-950">
              Tilo HQ
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <span className="hidden rounded-full border-2 border-amber-950/20 px-3 py-1 text-[0.7rem] font-black uppercase tracking-widest text-amber-900 sm:block">
              {isAdmin ? 'Boss' : 'Crew'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-full border-2 border-amber-950 bg-transparent font-black uppercase tracking-wide text-amber-950 hover:bg-amber-950 hover:text-amber-300"
            >
              {signingOut ? 'Bailing…' : 'Bail out'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside>
          <div className="rounded-[1.5rem] border-2 border-amber-950 bg-white p-3 dark:bg-stone-900">
            <p className="truncate px-2 pt-1 text-xs font-black uppercase tracking-widest text-yellow-600">
              {session.user.email ?? session.user.name ?? 'Account'}
            </p>
            <div className="mt-2">
              <DashboardNav />
            </div>
          </div>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
