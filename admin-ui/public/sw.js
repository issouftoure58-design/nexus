/**
 * NEXUS Admin — Service Worker
 * Cache le shell de l'app uniquement, JAMAIS les requêtes API.
 */

const CACHE_VERSION = 'nexus-v1';
const SHELL_ASSETS = [
  '/',
  '/nexus-icon.svg',
  '/icons/nexus-192x192.png',
  '/icons/nexus-512x512.png',
];

// Install — precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate — cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — routing strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API calls → Network only (NEVER cache)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api')) {
    return;
  }

  // 2. SSE / EventSource → Network only
  if (request.headers.get('accept')?.includes('text/event-stream')) {
    return;
  }

  // 3. Chrome extensions, non-http → ignore
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 4. Static assets (JS/CSS/images/fonts) → Cache first, fallback network
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|eot)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            // Only cache successful responses
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // 5. Navigation (HTML) → Network first, fallback cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/') || caches.match(request))
    );
    return;
  }
});
