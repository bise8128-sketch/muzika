/**
 * Muzika Service Worker
 * Refined for premium offline support and ML model caching.
 */

const CACHE_VERSION = 'v4';
const SHELL_CACHE = `muzika-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `muzika-assets-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline.html';

const INITIAL_CACHED_RESOURCES = [
  '/',
  OFFLINE_URL,
  '/manifest.json',
  '/sw-register.js',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
  '/offline.html',
];

// ── Install ────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(INITIAL_CACHED_RESOURCES);
    })
  );
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (![SHELL_CACHE, ASSET_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch ──────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  // 1. Models & WASM — Let the main thread/IndexedDB handle these
  // We explicitly bypass sw caching for large binary models to avoid double storage
  if (url.pathname.startsWith('/models/') || url.pathname.startsWith('/wasm/')) {
    return; 
  }

  // 2. Static Assets — Stale While Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    /\.(js|css|woff2?|ttf|png|jpg|webp|svg|ico)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
    return;
  }

  // 3. Navigation — Network First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Generic Strategy: Network First
  event.respondWith(
    fetch(request).catch(async () => {
      return caches.match(request);
    })
  );
});

// ── Strategies ─────────────────────────────────────────────────────

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetched = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || fetched;
}
