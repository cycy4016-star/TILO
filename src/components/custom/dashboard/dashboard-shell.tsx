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

export function DashboardShell({ children }: DashboardShellProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // Apply the owner's saved theme + appearance to <html> so the whole
    // workspace recolors coherently. Runs once on mount; StoreWorkspace
    // re-applies immediately after a save. Falls back to the default
    // (gold/vibrant) when the store hasn't been set up yet.
    let cancelled = false;
    async function applyStoreLook() {
      try {
        const res = await fetch('/api/store', { cache: 'no-store' });
        if (cancelled || !res.ok) return;
        const store = (await res.json()) as { theme?: string; appearance?: string };
        const html = document.documentElement;
        if (store.theme) html.dataset.theme = store.theme;
        if (store.appearance) html.dataset.appearance = store.appearance;
      } catch {
        // Store API is auth-gated; ignore errors silently.
      }
    }
    void applyStoreLook();
    return () => {
      cancelled = true;
    };
  }, []);

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
      <main className="flex min-h-dvh items-center justify-center bg-[var(--tl-50)] px-5 dark:bg-stone-950">
        <p className="animate-pulse font-display text-sm font-black uppercase tracking-[0.25em] text-[var(--tl-cta)]">
          Warming up…
        </p>
      </main>
    );
  }

  if (!session?.user) {
    // The effect above redirects to /login; this is the brief transition state,
    // not a stable screen.
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--tl-50)] px-5 dark:bg-stone-950">
        <p className="font-display text-sm font-black uppercase tracking-[0.25em] text-[var(--tl-cta)]">
          Rolling to sign in…
        </p>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[var(--tl-50)] text-stone-900 dark:bg-stone-950 dark:text-amber-50">
      <div className="shrink-0 border-b-4 border-[var(--tl-950)] bg-[var(--tl-300)]">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 -rotate-6 items-center justify-center rounded-xl bg-[var(--tl-950)] text-[var(--tl-300)]">
              <Flame aria-hidden="true" className="size-4" />
            </span>
            <span className="truncate font-display text-lg font-black uppercase tracking-tight text-[var(--tl-950)]">
              Tilo HQ
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <span className="hidden rounded-full border-2 border-[var(--tl-950)]/20 px-3 py-1 text-[0.7rem] font-black uppercase tracking-widest text-[var(--tl-900)] sm:block">
              Boss
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-full border-2 border-[var(--tl-950)] bg-transparent font-black uppercase tracking-wide text-[var(--tl-950)] hover:bg-[var(--tl-950)] hover:text-[var(--tl-300)]"
            >
              {signingOut ? 'Bailing…' : 'Bail out'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 gap-6 px-5 py-6 sm:px-8">
        <aside className="hidden w-[220px] shrink-0 overflow-y-auto lg:block">
          <div className="rounded-[1.5rem] border-2 border-[var(--tl-950)] bg-white p-3 dark:bg-stone-900">
            <p className="truncate px-2 pt-1 text-xs font-black uppercase tracking-widest text-[var(--tl-cta)]">
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
