/**
 * Audio cache utilities for storing and retrieving separation results
 * Implements LRU eviction policy for quota management
 */

import { db } from './audioDatabase';
import type { CachedAudio } from '@/types/storage';

export class AudioCache {
    /**
     * Generate SHA-256 hash of a file for cache lookup
     */
    async hashFile(file: File): Promise<string> {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    /**
     * Cache audio separation results in IndexedDB
     */
    async cacheAudioResult(
        fileHash: string,
        fileName: string,
        fileSizeBytes: number,
        vocals: ArrayBuffer,
        instrumentals: ArrayBuffer,
        duration: number,
        sampleRate: number,
        modelUsed: string
    ): Promise<void> {
        const cacheData: CachedAudio = {
            fileHash,
            fileName,
            fileSizeBytes,
            vocals,
            instrumentals,
            originalSize: vocals.byteLength + instrumentals.byteLength,
            processedAt: Date.now(),
            duration,
            sampleRate,
            modelUsed,
        };

        // Check if already cached (same file AND same model)
        const existing = await db.cachedAudio
            .where('[fileHash+modelUsed]')
            .equals([fileHash, modelUsed])
            .first();

        if (existing) {
            // Update existing cache
            await db.cachedAudio.update(existing.id!, cacheData);
            console.log(`✅ Updated cached audio: ${fileName} (${modelUsed})`);
        } else {
            // Add new cache entry
            await db.cachedAudio.add(cacheData);
            console.log(`✅ Cached audio: ${fileName} (${modelUsed})`);

            // Check quota and evict if necessary
            await this.evictOldestIfNeeded();
        }
    }

    /**
     * Retrieve cached audio results
     */
    async getCachedAudio(fileHash: string, modelUsed?: string): Promise<CachedAudio | null> {
        let cached: CachedAudio | undefined;

        if (modelUsed) {
            // Precise match
            cached = await db.cachedAudio
                .where('[fileHash+modelUsed]')
                .equals([fileHash, modelUsed])
                .first();
        } else {
            // Fallback: any result for this file
            cached = await db.cachedAudio.where('fileHash').equals(fileHash).first();
        }

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
    async deleteCachedAudio(fileHash: string): Promise<void> {
        await db.cachedAudio.where('fileHash').equals(fileHash).delete();
        console.log(`❌ Deleted cached audio for hash: ${fileHash.substring(0, 8)}...`);
    }

    /**
     * Clear all cached audio
     */
    async clearAudioCache(): Promise<void> {
        const count = await db.cachedAudio.count();
        await db.cachedAudio.clear();
        console.log(`❌ Cleared ${count} cached audio files`);
    }

    /**
     * Get all cached audio entries
     */
    async getAllCachedAudio(): Promise<CachedAudio[]> {
        return await db.cachedAudio.toArray();
    }

    /**
     * Get cache statistics
     */
    async getCacheStats(): Promise<{
        totalFiles: number;
        totalSizeGB: number;
        oldestFile: Date | null;
        newestFile: Date | null;
        files: Array<{
            name: string;
            size: number;
            duration: number;
            processedAt: Date;
            modelUsed: string;
        }>;
    }> {
        const files = await db.cachedAudio.toArray();

        const totalSizeBytes = files.reduce(
            (sum, f) => sum + f.vocals.byteLength + f.instrumentals.byteLength,
            0
        );

        const oldestFile = files.length > 0
            ? new Date(Math.min(...files.map((f) => f.processedAt)))
            : null;

        const newestFile = files.length > 0
            ? new Date(Math.max(...files.map((f) => f.processedAt)))
            : null;

        const filesList = files.map((f) => ({
            name: f.fileName,
            size: f.vocals.byteLength + f.instrumentals.byteLength,
            duration: f.duration,
            processedAt: new Date(f.processedAt),
            modelUsed: f.modelUsed
        }));

        return {
            totalFiles: files.length,
            totalSizeGB: totalSizeBytes / (1024 * 1024 * 1024),
            oldestFile,
            newestFile,
            files: filesList,
        };
    }

    /**
     * LRU eviction policy - Remove oldest entries if quota is exceeded
     */
    async evictOldestIfNeeded(maxSizeGB: number = 1): Promise<void> {
        const maxSizeBytes = maxSizeGB * 1024 * 1024 * 1024;

        // Check if we need to evict based on total size first
        const stats = await this.getCacheStats();
        if (stats.totalSizeGB * 1024 * 1024 * 1024 <= maxSizeBytes) {
            return;
        }

        // Get all files sorted by processedAt (oldest first)
        // Dexie sortBy is ascending, so first items are oldest
        const files = await db.cachedAudio.orderBy('processedAt').toArray();

        let currentSize = 0;
        // Calculate total size
        for (const file of files) {
            currentSize += file.vocals.byteLength + file.instrumentals.byteLength;
        }

        // Evict oldest until we are under the limit
        for (const file of files) {
            if (currentSize <= maxSizeBytes) break;

            const fileSize = file.vocals.byteLength + file.instrumentals.byteLength;
            await db.cachedAudio.delete(file.id!);
            currentSize -= fileSize;
            console.log(`🗑️ Evicted old cache entry: ${file.fileName} (${file.modelUsed})`);
        }
    }
}

export const audioCache = new AudioCache();
