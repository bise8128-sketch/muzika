import { db } from './audioDatabase';
import type { LyricSyncCacheEntry } from '@/types/storage';
import { SyncResult } from '@/utils/ml/lyricSync';

function isBrowser(): boolean {
    const isWindow = typeof window !== 'undefined';
    const isSelf = typeof self !== 'undefined';
    const hasIndexedDB = typeof indexedDB !== 'undefined';
    return (isWindow || isSelf) && hasIndexedDB;
}

export class LyricSyncCache {
    /**
     * Cache ML alignment result
     */
    async cacheSyncResult(fileHash: string, modelUsed: string, result: SyncResult): Promise<void> {
        if (!isBrowser()) return;

        const cacheData: LyricSyncCacheEntry = {
            fileHash,
            modelUsed,
            processedAt: Date.now(),
            result
        };

        try {
            const existing = await db.lyricSyncCache
                .where('[fileHash+modelUsed]')
                .equals([fileHash, modelUsed])
                .first();

            if (existing) {
                await db.lyricSyncCache.update(existing.id!, {
                    processedAt: cacheData.processedAt,
                    result: cacheData.result
                });
            } else {
                await db.lyricSyncCache.add(cacheData);
            }
        } catch (err) {
            console.error('[LyricSyncCache] Failed to cache sync result:', err);
        }
    }

    /**
     * Retrieve cached alignment result
     */
    async getCachedSync(fileHash: string, modelUsed: string): Promise<SyncResult | null> {
        if (!isBrowser()) return null;

        try {
            const cached = await db.lyricSyncCache
                .where('[fileHash+modelUsed]')
                .equals([fileHash, modelUsed])
                .first();

            if (cached) {
                // Update access timestamp (fire and forget)
                db.lyricSyncCache.update(cached.id!, { processedAt: Date.now() }).catch(() => {});
                return cached.result as SyncResult;
            }
        } catch (err) {
            console.error('[LyricSyncCache] Failed to retrieve cached sync:', err);
        }

        return null;
    }

    /**
     * Delete cached sync result
     */
    async deleteCachedSync(fileHash: string): Promise<void> {
        if (!isBrowser()) return;
        try {
            await db.lyricSyncCache.where('fileHash').equals(fileHash).delete();
        } catch (err) {
            console.error('[LyricSyncCache] Failed to delete cached sync:', err);
        }
    }

    /**
     * Clear all cached sync results
     */
    async clearCache(): Promise<void> {
        if (!isBrowser()) return;
        try {
            await db.lyricSyncCache.clear();
        } catch (err) {
            console.error('[LyricSyncCache] Failed to clear sync cache:', err);
        }
    }
}

export const lyricSyncCache = new LyricSyncCache();
