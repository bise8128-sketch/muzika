import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, CacheFirst, BackgroundSyncPlugin } from "serwist";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const syncPlugin = new BackgroundSyncPlugin("server-processing-queue", {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. Bypass Service Worker caching for large ONNX Models
    // IndexedDB manages these, we do not want to fill the SW Cache
    {
      matcher: ({ url }) => url.pathname.startsWith("/models/"),
      handler: new NetworkOnly(),
    },

    // 2. Background Sync for API backend (FastAPI)
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/backend-upload") || url.pathname.startsWith("/api/python-processing"),
      handler: new NetworkOnly({
        plugins: [syncPlugin],
      }),
      method: "POST",
    },
    {
      matcher: ({ url }) => url.port === "8000" || url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },

    // 3. Cache WASM binaries with CacheFirst
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/wasm/") || url.pathname.startsWith("/ffmpeg/"),
      handler: new CacheFirst({
        cacheName: "wasm-assets",
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              if (response && response.status === 200) {
                return response;
              }
              return null;
            },
          }
        ]
      }),
    },

    // 4. Default caching strategy for everything else (Next.js assets)
    ...defaultCache,
  ],
});

serwist.addEventListeners();

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  const { url, fileHash } = event.notification.data || {};
  let urlToOpen = url || "/";

  // Handle specific actions
  if (event.action === 'download' && fileHash) {
    urlToOpen = `/karaoke/${fileHash}?action=download`;
  } else if (event.action === 'play-now' && fileHash) {
    urlToOpen = `/karaoke/${fileHash}`;
  }

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});
