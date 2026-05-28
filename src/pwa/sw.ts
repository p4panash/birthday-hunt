/// <reference lib="webworker" />
// Custom service worker for goodLoot PWA.
//
// Responsibilities:
// 1. Pre-cache app shell (via workbox precacheAndRoute on the manifest
//    injected by vite-plugin-pwa).
// 2. Runtime cache for OSM tiles + Google Fonts.
// 3. Handle `push` events → show OS notification.
// 4. Handle `notificationclick` → focus the open client or open a new one.
// 5. Skip waiting + clients claim on the new SW so updates roll out fast
//    once the user accepts the toast.

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import {
  CacheFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Injected by vite-plugin-pwa at build time:
precacheAndRoute(self.__WB_MANIFEST);

// OSM tiles — survive offline once cached.
registerRoute(
  ({ url }) =>
    url.hostname === 'a.tile.openstreetmap.org' ||
    url.hostname === 'b.tile.openstreetmap.org' ||
    url.hostname === 'c.tile.openstreetmap.org',
  new StaleWhileRevalidate({
    cacheName: 'osm-tiles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
);

// Google Fonts CSS — short-lived stale-while-revalidate.
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'gfonts-css' }),
);

// Google Fonts woff2 — long-lived immutable.
registerRoute(
  ({ url }) => url.hostname === 'fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gfonts-woff2',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  }),
);

// ── Push notifications ───────────────────────────────────────────

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload;
  try {
    payload = event.data?.json() as PushPayload;
  } catch {
    payload = { title: 'goodLoot', body: 'New activity in your hunt.' };
  }
  if (!payload || !payload.title) {
    payload = { title: 'goodLoot', body: 'New activity in your hunt.' };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if (client.url.includes(url)) {
          await client.focus();
          return;
        }
      }
      if (all.length > 0) {
        const first = all[0];
        await first.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// ── Lifecycle: respond to skipWaiting messages from the update toast ──

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
