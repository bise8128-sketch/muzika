/**
 * Muzika Service Worker
 * Refined for premium offline support and ML model caching.
 */

const CACHE_VERSION = 'v2';
const SHELL_CACHE = `muzika-shell-${CACHE_VERSION}`;
const MODEL_CACHE = `muzika-models-${CACHE_VERSION}`;
const ASSET_CACHE = `muzika-assets-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline.html';

const INITIAL_CACHED_RESOURCES = [
  '/',
  OFFLINE_URL,
  '/manifest.json',
  '/sw-register.js',
  '/icon-192.png',
  '/icon-512.png',
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
          if (![SHELL_CACHE, MODEL_CACHE, ASSET_CACHE].includes(key)) {
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

  // Skip cross-origin requests (except HF for models)
  const isHF = url.hostname === 'huggingface.co' || url.hostname.endsWith('hf.co');
  if (url.origin !== self.location.origin && !isHF) return;
  if (request.method !== 'GET') return;

  // 1. Models & WASM — Cache First (Immutable)
  if (isHF || url.pathname.startsWith('/models/') || url.pathname.startsWith('/wasm/')) {
    event.respondWith(cacheFirst(request, MODEL_CACHE));
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
          // Cache the page for next time
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

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline model access failed', { status: 503 });
  }
}

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
