/**
 * Muzika Service Worker
 *
 * Caching strategies:
 *   1. Shell (cache-first) — HTML, CSS, JS, fonts
 *   2. Models (cache-first) — ONNX models, WASM binaries
 *   3. Audio (network-first) — processed audio blobs
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE  = `muzika-shell-${CACHE_VERSION}`;
const MODEL_CACHE  = `muzika-models-${CACHE_VERSION}`;
const AUDIO_CACHE  = `muzika-audio-${CACHE_VERSION}`;

const SHELL_URLS = [
  '/',
  '/manifest.json',
];

// ── Install ────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ── Activate — clean old caches ────────────────────────────────────

self.addEventListener('activate', (event) => {
  const keepCaches = new Set([SHELL_CACHE, MODEL_CACHE, AUDIO_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keepCaches.has(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ──────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // 1. Models & WASM — cache-first, immutable
  if (url.pathname.startsWith('/models/') || url.pathname.startsWith('/wasm/')) {
    event.respondWith(cacheFirst(event.request, MODEL_CACHE));
    return;
  }

  // 2. Static assets (JS/CSS/fonts) — cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request, SHELL_CACHE));
    return;
  }

  // 3. Audio files — network-first (user always wants fresh results)
  if (url.pathname.startsWith('/audio/') || url.pathname.startsWith('/api/')) {
    // Don't cache API calls or audio
    return;
  }

  // 4. Navigation / everything else — network-first with shell fallback
  event.respondWith(networkFirst(event.request, SHELL_CACHE));
});

// ── Strategies ─────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|eot|svg|png|jpg|webp|ico)$/.test(pathname) ||
    pathname.startsWith('/_next/static/');
}
