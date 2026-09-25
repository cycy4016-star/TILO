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
import { AppearancePicker } from './appearance-picker';
import { DashboardNav } from './dashboard-nav';

export interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace('/login');
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
      <main className="flex min-h-dvh items-center justify-center bg-background px-5 dark:bg-stone-950">
        <p className="animate-pulse text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Loading…
        </p>
      </main>
    );
  }

  if (!session?.user) {
    // The effect above redirects to /login; this is the brief transition state,
    // not a stable screen.
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-5 dark:bg-stone-950">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Signing you in…
        </p>
      </main>
    );
  }

  return (
    <main
      data-platform="app"
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground dark:bg-stone-950"
    >
      <div className="shrink-0 border-b border-border bg-white dark:bg-stone-950">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Flame aria-hidden="true" className="size-4" />
            </span>
            <span className="truncate font-display text-lg font-black uppercase tracking-tight text-foreground">
              Tilo
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <AppearancePicker />
            <NotificationBell />
            <span className="hidden rounded-full border border-border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground sm:block">
              Boss
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-full border-border font-semibold text-foreground hover:bg-muted"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 gap-6 px-5 py-6 sm:px-8">
        <aside className="hidden w-[220px] shrink-0 overflow-y-auto lg:block">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="truncate px-2 pt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {session.user.email ?? session.user.name ?? 'Account'}
            </p>
            <div className="mt-2">
              <DashboardNav />
            </div>
          </div>
        </aside>

        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</section>
      </div>
    </main>
  );
}
