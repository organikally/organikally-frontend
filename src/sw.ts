/// <reference lib="webworker" />
// Custom service worker (injectManifest). Responsibilities (CONTRACT §7):
//  - Precache the app shell so the field app opens offline after first load.
//  - Serve a network-first navigation handler with offline shell fallback.
//  - Cache-first for static assets, stale-while-revalidate for fonts.
//  - Background Sync registration that nudges the page to drain the queue.
//
// The mutation queue itself lives in the page (IndexedDB + sync.ts) so it can
// share TanStack Query / Zustand state. On reconnect the SW posts a message the
// app listens for to trigger an immediate drain; it also serves the precached
// shell so the offline-first promise holds.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import {
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);
clientsClaim();

// SPA navigation: network-first, fall back to cached shell when offline.
const navHandler = new NetworkFirst({
  cacheName: 'pages',
  networkTimeoutSeconds: 4,
  plugins: [new CacheableResponsePlugin({ statuses: [200] })],
});
registerRoute(
  new NavigationRoute(navHandler, {
    // Don't intercept API or media requests.
    denylist: [/\/api\//, /\/media\//],
  }),
);

// Google Fonts — SWR + cache.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' }),
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// Cached media (already-uploaded photo URLs) — cache-first, capped.
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/media/') || request.destination === 'image',
  new CacheFirst({
    cacheName: 'media',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

// Reference GETs (catalog/outlets/config) — network-first so fresh when online,
// cached for offline reads. Mutations are NOT cached; they go through the
// in-page IndexedDB queue.
registerRoute(
  ({ url, request }) =>
    url.pathname.includes('/api/v1/') &&
    request.method === 'GET' &&
    /\/(skus|outlets|config|routes|visits|orders|payments|sync\/bootstrap)/.test(
      url.pathname,
    ),
  new NetworkFirst({
    cacheName: 'api-get',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
);

// On reconnect (Background Sync), tell open clients to drain the queue.
self.addEventListener('sync', (event) => {
  const e = event as unknown as { tag: string; waitUntil: (p: Promise<unknown>) => void };
  if (e.tag === 'organikaly-sync') {
    e.waitUntil(notifyClients('SYNC_NOW'));
  }
});

self.addEventListener('message', (event) => {
  if ((event as ExtendableMessageEvent).data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

async function notifyClients(type: string): Promise<void> {
  const all = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of all) c.postMessage({ type });
}
