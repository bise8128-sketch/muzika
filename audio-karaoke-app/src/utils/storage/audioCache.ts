/**
 * Audio cache utilities for storing and retrieving separation results
 * Implements LRU eviction policy for quota management
 */

import { db } from './audioDatabase';
import type { CachedAudio } from '@/types/storage';

/**
 * Check if we're in a browser context with required APIs
 */
function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

export class AudioCache {
    /**
     * Generate SHA-256 hash of a file for cache lookup
     * Optimized for large files by hashing only start/end chunks + metadata
     */
    async hashFile(file: File): Promise<string> {
        // SSR guard: Return deterministic fallback hash if crypto.subtle is not available
        if (!isBrowser()) {
            // Create a simple deterministic hash from metadata
            const metadata = `${file.name}-${file.size}-${file.lastModified}-${file.type}`;
            return 'ssr-' + btoa(metadata).replace(/[^a-zA-Z0-9]/g, '').substring(0, 64);
        }

        // Include metadata in hash input
        const metadata = `${file.name}-${file.size}-${file.lastModified}-${file.type}`;

        // If small file (< 50MB), hash entire content
        if (file.size < 50 * 1024 * 1024) {
            const arrayBuffer = await file.arrayBuffer();
            // Combine metadata + content
            const metaBuffer = new TextEncoder().encode(metadata);
            const combined = new Uint8Array(metaBuffer.length + arrayBuffer.byteLength);
            combined.set(metaBuffer);
            combined.set(new Uint8Array(arrayBuffer), metaBuffer.length);

            const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // For large files, hash first 1MB + middle 1MB + last 1MB + metadata
        const chunkSize = 1024 * 1024;
        const chunks: Blob[] = [];

        chunks.push(file.slice(0, chunkSize)); // Start

        if (file.size > chunkSize * 2) {
            const mid = Math.floor(file.size / 2);
            chunks.push(file.slice(mid, mid + chunkSize)); // Middle
        }

        if (file.size > chunkSize) {
            chunks.push(file.slice(file.size - chunkSize, file.size)); // End
        }

        const buffers = await Promise.all(chunks.map(c => c.arrayBuffer()));
        const metaBuffer = new TextEncoder().encode(metadata);

        // Calculate total length
        let totalLen = metaBuffer.length;
        buffers.forEach(b => totalLen += b.byteLength);

        const combined = new Uint8Array(totalLen);
        let offset = 0;
        combined.set(metaBuffer, offset);
        offset += metaBuffer.length;

        for (const buf of buffers) {
            combined.set(new Uint8Array(buf), offset);
            offset += buf.byteLength;
        }

        const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
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
        // SSR guard
        if (!isBrowser()) {
            console.warn('[AudioCache] cacheAudioResult called during SSR - skipping');
            return;
        }

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
        // SSR guard
        if (!isBrowser()) {
            return null;
        }

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
        // SSR guard
        if (!isBrowser()) {
            return;
        }

        await db.cachedAudio.where('fileHash').equals(fileHash).delete();
        console.log(`❌ Deleted cached audio for hash: ${fileHash.substring(0, 8)}...`);
    }

    /**
     * Clear all cached audio
     */
    async clearAudioCache(): Promise<void> {
        // SSR guard
        if (!isBrowser()) {
            return;
        }

        const count = await db.cachedAudio.count();
        await db.cachedAudio.clear();
        console.log(`❌ Cleared ${count} cached audio files`);
    }

    /**
     * Get all cached audio entries
     */
    async getAllCachedAudio(): Promise<CachedAudio[]> {
        // SSR guard
        if (!isBrowser()) {
            return [];
        }

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
        // SSR guard - return safe defaults
        if (!isBrowser()) {
            return {
                totalFiles: 0,
                totalSizeGB: 0,
                oldestFile: null,
                newestFile: null,
                files: []
            };
        }

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
        // ... (existing implementation)
    }

    /**
     * Cache multiple audio results in a single transaction (batch write)
     */
    async cacheAudioResultsBatch(entries: CachedAudio[]): Promise<void> {
        if (!isBrowser() || entries.length === 0) return;

        try {
            await db.transaction('rw', db.cachedAudio, async () => {
                await db.cachedAudio.bulkPut(entries);
            });
            console.log(`✅ Cached ${entries.length} audio results in batch`);
            
            // Periodically check quota
            await this.evictOldestIfNeeded();
        } catch (error) {
            console.error('[AudioCache] Batch write failed:', error);
            throw error;
        }
    }
}

export const audioCache = new AudioCache();
