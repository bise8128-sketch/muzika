/**
 * Audio cache utilities for storing and retrieving separation results
 * Implements LRU eviction policy for quota management
 */

import { db } from './audioDatabase';
import type { CachedAudio } from '@/types/storage';

/**
 * Generate SHA-256 hash of a file for cache lookup
 */
export async function hashFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Cache audio separation results in IndexedDB
 */
export async function cacheAudioResult(
    fileHash: string,
    fileName: string,
    vocals: ArrayBuffer,
    instrumentals: ArrayBuffer,
    duration: number,
    sampleRate: number
): Promise<void> {
    const cacheData: CachedAudio = {
        fileHash,
        fileName,
        vocals,
        instrumentals,
        originalSize: vocals.byteLength + instrumentals.byteLength,
        processedAt: Date.now(),
        duration,
        sampleRate,
    };

    // Check if already cached
    const existing = await db.cachedAudio.where('fileHash').equals(fileHash).first();

    if (existing) {
        // Update existing cache
        await db.cachedAudio.update(existing.id!, cacheData);
    } else {
        // Add new cache entry
        await db.cachedAudio.add(cacheData);

        // Check quota and evict if necessary
        await enforceQuotaLimit();
    }
}

/**
 * Retrieve cached audio results
 */
export async function getCachedAudio(fileHash: string): Promise<CachedAudio | null> {
    const cached = await db.cachedAudio.where('fileHash').equals(fileHash).first();

    if (cached) {
        // Update access time for LRU
        await db.cachedAudio.update(cached.id!, { processedAt: Date.now() });
        return cached;
    }

    return null;
}

/**
 * Delete cached audio by file hash
 */
export async function deleteCachedAudio(fileHash: string): Promise<void> {
    await db.cachedAudio.where('fileHash').equals(fileHash).delete();
}

/**
 * Clear all cached audio
 */
export async function clearAllCachedAudio(): Promise<void> {
    await db.cachedAudio.clear();
}

/**
 * Get all cached audio entries
 */
export async function getAllCachedAudio(): Promise<CachedAudio[]> {
    return await db.cachedAudio.toArray();
}

/**
 * LRU eviction policy - Remove oldest entries if quota is exceeded
 * Target: Keep usage under 80% of quota
 */
async function enforceQuotaLimit(): Promise<void> {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) {
        return;
    }

    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;

    if (quota === 0) return;

    const usagePercentage = (usage / quota) * 100;
    const targetPercentage = 80; // Keep under 80%

    if (usagePercentage > targetPercentage) {
        // Get all cached audio sorted by access time (oldest first)
        const allCached = await db.cachedAudio.orderBy('processedAt').toArray();

        // Calculate how much we need to free
        const targetUsage = quota * (targetPercentage / 100);
        const toFree = usage - targetUsage;

        let freed = 0;
        let index = 0;

        // Remove oldest entries until we've freed enough space
        while (freed < toFree && index < allCached.length) {
            const item = allCached[index];
            const itemSize = item.vocals.byteLength + item.instrumentals.byteLength;

            await db.cachedAudio.delete(item.id!);
            freed += itemSize;
            index++;
        }

        console.log(`LRU eviction: Removed ${index} cached audio files, freed ${(freed / 1024 / 1024).toFixed(2)} MB`);
    }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
    const allCached = await db.cachedAudio.toArray();

    let totalSize = 0;
    allCached.forEach(item => {
        totalSize += item.vocals.byteLength + item.instrumentals.byteLength;
    });

    return {
        count: allCached.length,
        totalSize,
        totalSizeMB: totalSize / 1024 / 1024,
        items: allCached.map(item => ({
            fileName: item.fileName,
            fileHash: item.fileHash,
            size: item.vocals.byteLength + item.instrumentals.byteLength,
            processedAt: new Date(item.processedAt),
        })),
    };
}
