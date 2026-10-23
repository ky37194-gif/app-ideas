/* Service worker = a small helper that lets the app open WITHOUT internet.
   Your files (index.html, icons…): try the network first (so updates arrive), else use the saved copy.
   Cloud sync (/api/…) always goes to the network, never the cache. */

const CACHE = 'app-ideas-v10';

const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// 1. Install: save everything the app needs
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_FILES);
    self.skipWaiting();
  })());
});

// 2. Activate: remove old caches from previous versions
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// 3. Fetch: network first, fall back to the saved copy when offline
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html'));
    }
  })());
});
