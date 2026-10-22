// Client-safe web-push helpers shared by the courier app and buyer tracker.
import { apiFetch } from '@/lib/api-client';
import { PushSubscribeResult } from '@/lib/contracts/push';

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

export function pushErrorMessage(): string | null {
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return 'This browser does not support push notifications.';
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !standalone) {
    return 'Add Tilza to your Home Screen first, then open it from the icon.';
  }
  return null;
}

export async function hasPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return Boolean(subscription);
}

export async function subscribeToPush(
  publicKey: string,
  subscribePath: string,
): Promise<string | null> {
  const unsupported = pushErrorMessage();
  if (unsupported) return unsupported;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return 'Notifications were blocked. Allow them in your browser settings.';
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    return 'The browser returned an incomplete subscription.';
  }

  await apiFetch(subscribePath, {
    method: 'POST',
    body: JSON.stringify({ endpoint: json.endpoint, keys: { p256dh, auth } }),
    schema: PushSubscribeResult,
  });
  return null;
}

export async function unsubscribeFromPush(unsubscribePath: string): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await apiFetch(unsubscribePath, {
    method: 'DELETE',
    body: JSON.stringify({ endpoint: subscription.endpoint }),
    schema: PushSubscribeResult,
  }).catch(() => undefined);
  await subscription.unsubscribe();
}
