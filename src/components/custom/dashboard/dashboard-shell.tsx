// Tilza app code.
'use client';

import { LogOut, Menu } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { signOut, useIsAdmin, useSession } from '@/lib/auth-client';
import { QuickAccessPanel } from '../assistive-menu';
import { NotificationBell } from '../notification-bell';
import { TilzaLogo } from '../tilza-logo';
import { BrandMark } from './brand-mark';
import { DashboardNav } from './dashboard-nav';
import { TrialBanner } from './trial-banner';

export interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { data: session, isPending } = useSession();
  // Resolved only after isPending clears, so the chip is never stale.
  const isAdmin = useIsAdmin();
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
          <TilzaLogo className="text-3xl" />
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
          <TilzaLogo className="text-3xl" />
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
      <header className="shrink-0 border-b border-border bg-card">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
          <Link href="/dashboard" className="flex min-w-0 flex-1 items-center sm:flex-none">
            <TilzaLogo className="text-xl text-primary" />
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
            <BrandMark />
            <NotificationBell />
            {/* The role chip is a status, so it wears the status primitive
                rather than a one-off bordered pill. An operator owns no shop,
                so "Owner" would be a lie for them. */}
            <Badge variant="neutral" className="hidden sm:inline-flex">
              {isAdmin ? 'Operator' : 'Owner'}
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

      {/* Trial countdown — owners only. An operator owns no shop, so there is
          no trial to count down. */}
      {!isAdmin && <TrialBanner />}

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-0 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:gap-8">
        <nav
          aria-label="Dashboard sections"
          className="sticky top-0 z-10 -mx-4 shrink-0 border-b border-border bg-card px-4 py-2 lg:hidden"
        >
          <DashboardNav mobile />
        </nav>
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2.5 border-b border-border px-1 pb-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-highlight font-display text-small font-bold text-highlight-foreground">
                {(session.user.name ?? session.user.email ?? 'A').trim().charAt(0).toUpperCase()}
              </span>
              <p className="min-w-0">
                <span className="block truncate text-small font-semibold">
                  {session.user.name ?? 'Your shop'}
                </span>
                <span className="block truncate text-caption text-muted-foreground">
                  {session.user.email ?? 'Seller account'}
                </span>
              </p>
            </div>
            <div className="pt-2">
              <DashboardNav />
            </div>
          </div>
        </aside>

        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto pt-4 pb-24 lg:pt-0 lg:pb-6">
          {children}
        </section>
      </div>
    </main>
  );
}
