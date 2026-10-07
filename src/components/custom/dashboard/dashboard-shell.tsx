// Tilo app code.
'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { signOut, useSession } from '@/lib/auth-client';
import { QuickAccessPanel } from '../assistive-menu';
import { NotificationBell } from '../notification-bell';
import { TiloMark } from '../tilo-mark';
import { AppearancePicker } from './appearance-picker';
import { DashboardNav } from './dashboard-nav';

export interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [assistiveOpen, setAssistiveOpen] = useState(false);

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
      <main className="flex min-h-dvh items-center justify-center bg-background px-5">
        <p className="animate-pulse text-caption uppercase tracking-widest text-muted-foreground">
          Loading…
        </p>
      </main>
    );
  }

  if (!session?.user) {
    // The effect above redirects to /login; this is the brief transition state,
    // not a stable screen.
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-5">
        <p className="text-caption uppercase tracking-widest text-muted-foreground">
          Signing you in…
        </p>
      </main>
    );
  }

  return (
    <main
      data-platform="app"
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
    >
      <header className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <TiloMark className="size-9" iconClassName="size-5" />
            <span className="truncate font-display text-base font-semibold tracking-tight text-foreground">
              Tilo
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Popover open={assistiveOpen} onOpenChange={setAssistiveOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Quick access menu"
                  className="group hidden size-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted sm:inline-flex"
                >
                  <Menu
                    aria-hidden
                    className="size-4 transition-transform duration-300 group-hover:rotate-90"
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-2">
                <QuickAccessPanel onClose={() => setAssistiveOpen(false)} />
              </PopoverContent>
            </Popover>
            <AppearancePicker />
            <NotificationBell />
            <span className="hidden rounded-full border border-border px-2.5 py-1 text-caption font-medium text-muted-foreground sm:block">
              Boss
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-8 px-4 py-6 sm:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <p className="truncate px-3 pb-2 text-caption font-medium text-muted-foreground">
            {session.user.email ?? session.user.name ?? 'Account'}
          </p>
          <DashboardNav />
        </aside>

        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</section>
      </div>
    </main>
  );
}
