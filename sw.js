/* Service worker: precache di tutti gli asset, così l'app funziona offline.
   Cambia CACHE_VERSION a ogni modifica dei file per forzare l'aggiornamento. */
const CACHE_VERSION = 'v9';
const CACHE_NAME = `jp-vocab-${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './alpine.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// La pagina chiede di attivare subito il nuovo service worker.
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Navigazione: la shell arriva dalla cache, anche online. All'avvio non si
  // aspetta mai la rete; gli aggiornamenti passano dal service worker, che
  // precarica la nuova shell e fa comparire il banner "nuova versione".
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match('./index.html');
      if (cached) return cached;
      return fetch(request).catch(() => Response.error());
    })());
    return;
  }

  // Asset: cache-first, con aggiornamento in background.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const network = fetch(request)
      .then(res => { if (res.ok) cache.put(request, res.clone()); return res; })
      .catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
