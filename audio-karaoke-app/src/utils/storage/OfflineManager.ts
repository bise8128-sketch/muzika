/**
 * OfflineManager — Main-thread utility for managing offline audio caching.
 *
 * Communicates with the Service Worker via postMessage to cache audio blobs,
 * check cache status, and manage cache lifecycle.
 *
 * Usage:
 *   const offline = new OfflineManager();
 *   await offline.cacheAudio('/offline-audio/song-abc.mp3', audioBlob);
 *   const isCached = await offline.isCached('/offline-audio/song-abc.mp3');
 *   const status = await offline.getOfflineReadiness();
 */

export interface OfflineStatus {
  serviceWorkerActive: boolean;
  cachedUrls: string[];
  totalCacheSize: number;
  cacheCount: number;
}

export class OfflineManager {
  /**
   * Send audio data to the Service Worker for offline caching.
   */
  async cacheAudio(url: string, blob: Blob): Promise<void> {
    const sw = navigator.serviceWorker?.controller;
    if (!sw) {
      throw new Error('Service Worker is not active. Cannot cache audio for offline use.');
    }

    sw.postMessage({
      type: 'CACHE_AUDIO',
      url,
      blob,
    });
  }

  /**
   * Check whether a specific URL is in the offline audio cache.
   */
  async isCached(url: string): Promise<boolean> {
    const cache = await caches.open('audio-stems-v1');
    const response = await cache.match(url);
    return response !== undefined;
  }

  /**
   * Remove a specific URL or all entries from the offline audio cache.
   */
  async invalidateCache(url?: string): Promise<void> {
    const sw = navigator.serviceWorker?.controller;
    if (!sw) return;

    sw.postMessage({
      type: 'CACHE_INVALIDATE',
      url,
    });
  }

  /**
   * Get the total size of cached audio data.
   */
  async getCacheSize(): Promise<number> {
    const status = await this.getCacheStatus();
    return status.totalCacheSize;
  }

  /**
   * Get full offline readiness status including SW state and cache contents.
   */
  async getOfflineReadiness(): Promise<OfflineStatus> {
    const swActive = !!(navigator.serviceWorker?.controller);

    if (!swActive) {
      return {
        serviceWorkerActive: false,
        cachedUrls: [],
        totalCacheSize: 0,
        cacheCount: 0,
      };
    }

    const cacheStatus = await this.getCacheStatus();
    return {
      serviceWorkerActive: true,
      ...cacheStatus,
    };
  }

  /**
   * Request cache status from the Service Worker.
   * Returns cache contents via a round-trip postMessage.
   */
  private getCacheStatus(): Promise<{ cachedUrls: string[]; totalCacheSize: number; cacheCount: number }> {
    return new Promise((resolve) => {
      const sw = navigator.serviceWorker;
      if (!sw?.controller) {
        resolve({ cachedUrls: [], totalCacheSize: 0, cacheCount: 0 });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({ cachedUrls: [], totalCacheSize: 0, cacheCount: 0 });
      }, 5000);

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'CACHE_STATUS_RESPONSE') {
          clearTimeout(timeout);
          sw.removeEventListener('message', handler);
          resolve({
            cachedUrls: event.data.urls || [],
            totalCacheSize: event.data.totalSize || 0,
            cacheCount: event.data.count || 0,
          });
        }
      };

      sw.addEventListener('message', handler);
      sw.controller.postMessage({ type: 'GET_CACHE_STATUS' });
    });
  }
}

/** Singleton instance */
export const offlineManager = new OfflineManager();
