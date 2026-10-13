// Tilo app code.
'use client';

import { LogOut, Menu } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
        <div className="flex flex-col items-center gap-3">
          <TiloMark className="size-10" iconClassName="size-5" />
          <p className="text-small text-muted-foreground">Loading…</p>
        </div>
      </main>
    );
  }

  if (!session?.user) {
    // The effect above redirects to /login; this is the brief transition state,
    // not a stable screen.
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-5">
        <div className="flex flex-col items-center gap-3">
          <TiloMark className="size-10" iconClassName="size-5" />
          <p className="text-small text-muted-foreground">Signing you in…</p>
        </div>
      </main>
    );
  }

  return (
    <main
      data-platform="app"
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
    >
      <header className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
          <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
            <TiloMark className="size-9 shrink-0" iconClassName="size-5" />
            <span className="truncate font-display text-base font-semibold tracking-tight text-foreground">
              Tilo
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
            {/* The role chip is a status, so it wears the status primitive
                rather than a one-off bordered pill. */}
            <Badge variant="neutral" className="hidden sm:inline-flex">
              Owner
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
              className="hidden min-[420px]:inline-flex font-medium text-muted-foreground hover:text-foreground"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Sign out"
              className="size-9 shrink-0 text-muted-foreground hover:text-foreground min-[420px]:hidden"
            >
              <LogOut aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-0 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:gap-8">
        <nav
          aria-label="Dashboard sections"
          className="sticky top-0 z-10 -mx-4 shrink-0 border-b border-border bg-background/95 px-4 py-2 backdrop-blur lg:hidden"
        >
          <DashboardNav mobile />
        </nav>
        <aside className="hidden w-56 shrink-0 lg:block">
          {/* Sidebar header: the account line is a label, and it needs to
              separate from the nav below it — a hairline does that without
              adding a card. */}
          <p className="truncate border-b border-border px-3 pb-3 text-caption font-medium text-muted-foreground">
            {session.user.email ?? session.user.name ?? 'Account'}
          </p>
          <div className="pt-3">
            <DashboardNav />
          </div>
        </aside>

        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto pt-4 pb-24 lg:pt-0 lg:pb-6">
          {children}
        </section>
      </div>
    </main>
  );
}
