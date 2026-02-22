import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

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
      handler: "NetworkOnly",
    },

    // 2. Bypass API backend (FastAPI)
    {
      matcher: ({ url }) => url.port === "8000" || url.pathname.startsWith("/api/"),
      handler: "NetworkOnly",
    },

    // 3. Cache WASM binaries with CacheFirst
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/wasm/") || url.pathname.startsWith("/ffmpeg/"),
      handler: "CacheFirst",
      options: {
        cacheName: "wasm-assets",
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        },
      },
    },

    // 4. Default caching strategy for everything else (Next.js assets)
    ...defaultCache,
  ],
});

serwist.addEventListeners();
