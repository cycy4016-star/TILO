'use client';

import { Download, Share, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'tilza:pwa-install-dismissed';

type Platform = 'ios' | 'mac-safari' | 'other';

function isAppRoute(pathname: string): boolean {
  return pathname === '/welcome' || pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): Platform {
  const userAgent = navigator.userAgent;
  if (
    /iphone|ipad|ipod/i.test(userAgent) ||
    (/macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)
  ) {
    return 'ios';
  }
  if (
    /macintosh/i.test(userAgent) &&
    /safari/i.test(userAgent) &&
    !/chrome|chromium|crios|fxios|edg|opr/i.test(userAgent)
  ) {
    return 'mac-safari';
  }
  return 'other';
}

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberDismissed(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    return;
  }
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [eligible, setEligible] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>('other');
  const [helpOpen, setHelpOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;

    setPlatform(detectPlatform());
    setEligible(true);

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      rememberDismissed();
      setEligible(false);
    };
    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayMode = (event: MediaQueryListEvent) => {
      if (event.matches) setEligible(false);
    };

    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    media.addEventListener?.('change', onDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      media.removeEventListener?.('change', onDisplayMode);
    };
  }, []);

  function dismiss() {
    rememberDismissed();
    setEligible(false);
  }

  async function install() {
    if (!installPrompt) {
      setHelpOpen(true);
      return;
    }
    setInstalling(true);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      rememberDismissed();
      setEligible(false);
    } catch {
      setHelpOpen(true);
    } finally {
      setInstallPrompt(null);
      setInstalling(false);
    }
  }

  if (!eligible || isPending || !session?.user || !isAppRoute(pathname)) return null;

  const ios = platform === 'ios';
  const macSafari = platform === 'mac-safari';

  return (
    <section
      aria-label="Install Tilza"
      data-pwa-install-prompt
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-50 mx-auto flex max-w-md items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-xl sm:inset-x-auto sm:bottom-6 sm:left-6 sm:mx-0 sm:w-96"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-highlight-ink">
        <Download aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Install Tilza on this device</p>
        <p className="mt-0.5 text-small text-muted-foreground">
          {ios ? (
            <>
              Tap <Share aria-hidden className="mx-0.5 inline size-3.5" /> Share, then{' '}
              <span className="font-semibold text-foreground">Add to Home Screen</span>.
            </>
          ) : installPrompt ? (
            'Open your shop like an app, one tap from your home screen.'
          ) : macSafari ? (
            'In Safari, open the File menu and choose Add to Dock.'
          ) : (
            'Use your browser menu to install Tilza or add it to your home screen.'
          )}
        </p>
        {helpOpen && !ios && !installPrompt ? (
          <p className="mt-2 rounded-md bg-muted px-2.5 py-2 text-caption text-muted-foreground">
            {macSafari ? (
              <>
                Choose <span className="font-semibold text-foreground">File → Add to Dock</span>,
                then click Add. Requires macOS Sonoma or later.
              </>
            ) : (
              <>
                In Chrome or Edge, open the menu and choose{' '}
                <span className="font-semibold text-foreground">Install app</span>. In Safari on
                Mac, choose{' '}
                <span className="font-semibold text-foreground">File → Add to Dock</span>.
              </>
            )}
          </p>
        ) : null}
        {installPrompt ? (
          <Button
            type="button"
            size="sm"
            disabled={installing}
            onClick={() => void install()}
            className="mt-2.5 h-9 rounded-md font-semibold"
          >
            <Download aria-hidden className="size-4" />
            {installing ? 'Opening…' : 'Install app'}
          </Button>
        ) : !ios ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setHelpOpen((current) => !current)}
            className="mt-2.5 h-9 rounded-md font-semibold"
          >
            {helpOpen ? 'Hide steps' : 'How to install'}
          </Button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X aria-hidden className="size-4" />
      </button>
    </section>
  );
}
