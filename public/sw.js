const SHELL_CACHE = 'tilza-shell-v2';
const OFFLINE_URL = '/offline.html';
const SHELL_ASSETS = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('tilza-') && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).catch(async () => {
      const offline = await caches.match(OFFLINE_URL);
      return (
        offline ??
        new Response('You are offline.', {
          status: 503,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      );
    }),
  );
});

function readPush(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

function safeUrl(value) {
  try {
    const url = new URL(value || '/', self.location.origin);
    return url.origin === self.location.origin ? url.href : `${self.location.origin}/`;
  } catch {
    return `${self.location.origin}/`;
  }
}

self.addEventListener('push', (event) => {
  const payload = readPush(event);
  const url = safeUrl(payload.url);
  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'Tilza';
  const body = typeof payload.body === 'string' ? payload.body : '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: payload.icon || '/icons/icon-192.png',
      badge: payload.badge || '/icons/badge-96.png',
      tag: payload.tag || 'tilza',
      renotify: false,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = safeUrl(event.notification.data?.url);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(target)) {
          await client.focus();
          client.postMessage({ type: 'tilza:notification-click', url: target });
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
