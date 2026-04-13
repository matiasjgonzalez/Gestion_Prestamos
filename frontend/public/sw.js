const CACHE_NAME = 'gestion-prest-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => { if (k !== CACHE_NAME) return caches.delete(k); }))
    )
  );
  self.clients.claim();
});

// Simple runtime caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't handle navigation to external sites
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // API requests: network-first, fallback to cache
  if (url.pathname.startsWith('/api') || url.pathname.includes('/prestamos') || url.pathname.includes('/clientes') || url.pathname.includes('/mora')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      // Cache successful GET responses
      if (request.method === 'GET' && res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return res;
    }))
  );
});
