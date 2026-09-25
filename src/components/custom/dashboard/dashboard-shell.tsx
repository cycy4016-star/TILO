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
            <TiloMark className="size-9" iconClassName="size-5" />
            <span className="truncate font-display text-lg font-black uppercase tracking-tight text-foreground">
              Tilo
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Popover open={assistiveOpen} onOpenChange={setAssistiveOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Quick access menu"
                  className="group hidden size-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-emerald-600 to-sky-700 text-white shadow-[0_6px_18px_-6px_rgba(6,95,70,0.5)] transition-transform duration-300 hover:scale-110 active:scale-95 sm:inline-flex"
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
