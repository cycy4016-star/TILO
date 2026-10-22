'use client';

import { Bell, BellOff, Loader2, Send, Share, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  PushConfig,
  type PushConfig as PushConfigRecord,
  PushSubscribeResult,
  PushTestResult,
} from '@/lib/contracts/push';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

export function PushSettings() {
  const [config, setConfig] = useState<PushConfigRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [localSubscribed, setLocalSubscribed] = useState(false);
  const [busy, setBusy] = useState<'enable' | 'disable' | 'test' | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  const load = useCallback(async () => {
    const result = await apiFetch('/api/push', { schema: PushConfig }).catch(() => null);
    setConfig(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .getRegistration()
        .then(async (registration) => {
          const subscription = await registration?.pushManager.getSubscription();
          setLocalSubscribed(Boolean(subscription));
        })
        .catch(() => undefined);
    }

    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onInstallPrompt);
  }, [load]);

  async function enable() {
    if (!config?.configured || !config.publicKey) {
      toast.error('Push notifications are not configured on this deployment yet.');
      return;
    }
    if (isIos && !standalone) {
      toast.error('Add Tilza to your Home Screen first, then open it from the icon.');
      return;
    }
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      toast.error('This browser does not support push notifications.');
      return;
    }

    setBusy('enable');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notifications were blocked. Allow them in your browser settings.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        });
      }

      const json = subscription.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!json.endpoint || !p256dh || !auth) {
        throw new Error('The browser returned an incomplete subscription.');
      }

      await apiFetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh, auth },
        }),
        schema: PushSubscribeResult,
      });
      setLocalSubscribed(true);
      await load();
      toast.success('Notifications are on for this device');
    } catch {
      toast.error('Could not turn on notifications. Check browser permissions and try again.');
    } finally {
      setBusy(null);
    }
  }

  async function disable() {
    setBusy('disable');
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await apiFetch('/api/push/subscribe', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
          schema: PushSubscribeResult,
        });
        await subscription.unsubscribe();
      }
      setLocalSubscribed(false);
      await load();
      toast.success('Notifications are off for this device');
    } catch {
      toast.error('Could not turn off notifications. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy('test');
    try {
      const result = await apiFetch('/api/push/test', {
        method: 'POST',
        schema: PushTestResult,
      });
      if (result.sent > 0) {
        toast.success('Test sent — check your notifications');
      } else if (result.removed > 0) {
        toast.error('That device had expired. Turn notifications on again.');
      } else {
        toast.error('No active device found. Turn notifications on first.');
      }
    } catch {
      toast.error('Could not send a test notification.');
    } finally {
      setBusy(null);
    }
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  const enabled = localSubscribed;
  const otherDevice = !localSubscribed && (config?.deviceCount ?? 0) > 0;

  return (
    <section className="rounded-lg border border-border bg-card p-6 sm:p-7">
      <p className="flex items-center gap-1.5 text-eyebrow">
        <Smartphone aria-hidden className="size-3.5" /> Notifications
      </p>
      <h2 className="mt-1 text-h3 font-display">Order alerts on your phone.</h2>
      <p className="mt-1 max-w-lg text-sm text-muted-foreground">
        Get a push when a new order lands and a weekly summary of how your shop is doing. No app
        store, no monthly fee.
      </p>

      {loading ? (
        <div className="mt-5 h-20 animate-pulse rounded-lg border border-border bg-muted/40" />
      ) : !config?.configured ? (
        <div className="mt-5 rounded-lg border border-dashed border-border px-4 py-5 text-small text-muted-foreground">
          Web Push is not set up on this deployment yet.{' '}
          {config?.emailConfigured
            ? 'Email alerts still work.'
            : 'Email alerts are not configured yet either.'}
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                {enabled ? (
                  <Bell aria-hidden className="size-5" />
                ) : (
                  <BellOff aria-hidden className="size-5" />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {enabled
                    ? 'On for this device'
                    : otherDevice
                      ? 'On for another device'
                      : 'Off for this device'}
                </p>
                <p className="mt-0.5 text-small text-muted-foreground">
                  {enabled
                    ? 'New orders and weekly summaries can reach you here.'
                    : otherDevice
                      ? 'Turn it on here too, or manage your other browser separately.'
                      : 'Turn it on to get order alerts without opening the dashboard.'}
                </p>
              </div>
            </div>
            {enabled ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void disable()}
                disabled={busy !== null}
                className="h-10 rounded-md font-semibold"
              >
                {busy === 'disable' ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <BellOff aria-hidden className="size-4" />
                )}
                Turn off
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void enable()}
                disabled={busy !== null}
                className="h-10 rounded-md font-semibold"
              >
                {busy === 'enable' ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Bell aria-hidden className="size-4" />
                )}
                Turn on
              </Button>
            )}
          </div>

          <p className="text-caption text-muted-foreground">
            Email backup is {config?.emailConfigured ? 'on' : 'off'} for this deployment.
          </p>

          {enabled && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void sendTest()}
              disabled={busy !== null}
              className="h-9 w-fit rounded-md font-semibold"
            >
              {busy === 'test' ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Send aria-hidden className="size-4" />
              )}
              Send a test notification
            </Button>
          )}

          {isIos && !standalone && (
            <p className="rounded-lg bg-muted/60 px-4 py-3 text-small text-muted-foreground">
              On iPhone or iPad: tap <Share aria-hidden className="mx-1 inline size-3.5" /> Share,
              then <span className="font-semibold text-foreground">Add to Home Screen</span>. Open
              Tilza from the new icon, then turn notifications on.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div>
              <p className="text-sm font-semibold">Install Tilza</p>
              <p className="mt-0.5 text-small text-muted-foreground">
                Keep your shop one tap away, even when the browser is closed.
              </p>
            </div>
            {installPrompt ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void install()}
                className="h-9 rounded-md font-semibold"
              >
                <Smartphone aria-hidden className="size-4" /> Install app
              </Button>
            ) : (
              <p className="text-caption text-muted-foreground">
                {isIos ? 'Share → Add to Home Screen' : 'Browser menu → Install app'}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
