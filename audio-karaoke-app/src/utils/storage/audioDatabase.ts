/**
 * Dexie.js IndexedDB database configuration
 * Stores models, cached audio results, and processing logs
 */

import Dexie, { Table } from 'dexie';
import type { CachedAudio, ProcessingLog, ProcessingJob, SongEntry, Playlist, QueueState, LyricSyncCacheEntry } from '@/types/storage';
import type { ModelStorageData } from '@/types/model';

export class AudioKaraokeDB extends Dexie {
    // Table definitions
    models!: Table<ModelStorageData, number>;
    cachedAudio!: Table<CachedAudio, number>;
    processingLogs!: Table<ProcessingLog, number>;
    audioFiles!: Table<any, string>;
    songs!: Table<SongEntry, number>;
    playlists!: Table<Playlist, number>;
    queue!: Table<QueueState, number>;
    performanceHistory!: Table<any, number>;
    processingQueue!: Table<ProcessingJob, number>;
    lyricSyncCache!: Table<LyricSyncCacheEntry, number>;

    constructor() {
        super('AudioKaraokeDB');

        // Define database schema
        // Version 5: Added playlists and queue tables
        this.version(5).stores({
            models: '++id, modelId, name, version, downloadedAt',
            cachedAudio: '++id, fileHash, fileName, processedAt, [fileHash+modelUsed]',
            processingLogs: '++id, fileHash, status, startedAt',
            songs: '++id, type, title, artist, versionName, originalHash, createdAt, lastPlayedAt',
            playlists: '++id, name, createdAt, updatedAt',
            queue: '++id, currentIndex, shuffleMode, repeatMode, updatedAt'
        });

        this.version(7).stores({
            models: '++id, modelId, name, version, downloadedAt',
            cachedAudio: '++id, fileHash, fileName, processedAt, [fileHash+modelUsed]',
            processingLogs: '++id, fileHash, status, startedAt',
            songs: '++id, type, title, artist, versionName, originalHash, createdAt, lastPlayedAt',
            playlists: '++id, name, createdAt, updatedAt',
            queue: '++id, currentIndex, shuffleMode, repeatMode, updatedAt',
            performanceHistory: '++id, songId, fileHash, grade, score, createdAt'
        });

        // Version 8: Offline background processing queue
        this.version(8).stores({
            models: '++id, modelId, name, version, downloadedAt',
            cachedAudio: '++id, fileHash, fileName, processedAt, [fileHash+modelUsed]',
            processingLogs: '++id, fileHash, status, startedAt',
            songs: '++id, type, title, artist, versionName, originalHash, createdAt, lastPlayedAt',
            playlists: '++id, name, createdAt, updatedAt',
            queue: '++id, currentIndex, shuffleMode, repeatMode, updatedAt',
            performanceHistory: '++id, songId, fileHash, grade, score, createdAt',
            processingQueue: '++id, fileId, status',
            audioFiles: 'id, name, createdAt'
        });

        // Version 9: ML Alignment / Lyric Sync Cache
        this.version(9).stores({
            models: '++id, modelId, name, version, downloadedAt',
            cachedAudio: '++id, fileHash, fileName, processedAt, [fileHash+modelUsed]',
            lyricSyncCache: '++id, fileHash, modelUsed, processedAt, [fileHash+modelUsed]',
            processingLogs: '++id, fileHash, status, startedAt',
            songs: '++id, type, title, artist, versionName, originalHash, createdAt, lastPlayedAt',
            playlists: '++id, name, createdAt, updatedAt',
            queue: '++id, currentIndex, shuffleMode, repeatMode, updatedAt',
            performanceHistory: '++id, songId, fileHash, grade, score, createdAt',
            processingQueue: '++id, fileId, status',
            audioFiles: 'id, name, createdAt'
        });

        // Version 6: Hybrid storage support (OPFS paths)

        // Keep previous versions for migration history if needed
        this.version(4).stores({
            models: '++id, modelId, name, version, downloadedAt',
            cachedAudio: '++id, fileHash, fileName, processedAt, [fileHash+modelUsed]',
            processingLogs: '++id, fileHash, status, startedAt',
            songs: '++id, type, title, artist, versionName, originalHash, createdAt, lastPlayedAt'
        });

        this.version(3).stores({
            models: '++id, modelId, name, version, downloadedAt',
            cachedAudio: '++id, fileHash, fileName, processedAt, [fileHash+modelUsed]',
            processingLogs: '++id, fileHash, status, startedAt',
            songs: '++id, originalHash, customName, savedAt'
        }).upgrade(() => {
            // Basic migration if needed, but since structure changed significantly, we might just let it be or clear.
            // For now, no explicit data migration logic here as types are incompatible.
        });

        this.version(2).stores({
            models: '++id, modelId, name, version, downloadedAt',
            cachedAudio: '++id, fileHash, fileName, processedAt',
            processingLogs: '++id, fileHash, status, startedAt',
        });
    }

    /**
     * Clear all data from the database
     */
    async clearAll() {
        await this.models.clear();
        await this.cachedAudio.clear();
        await this.processingLogs.clear();
        await this.songs.clear();
        await this.playlists.clear();
        await this.queue.clear();
        await this.processingQueue.clear();
        await this.lyricSyncCache.clear();
    }

    /**
     * Get database size estimate
     */
    async getDatabaseSize(): Promise<number> {
        const models = await this.models.toArray();
        const audio = await this.cachedAudio.toArray();
        const songs = await this.songs.toArray();

        let totalSize = 0;

        models.forEach(model => {
            totalSize += model.size;
        });

        audio.forEach(item => {
            totalSize += item.vocals.byteLength + item.instrumentals.byteLength;
        });

        songs.forEach(song => {
            totalSize += (song.instrumentalData?.byteLength || 0) + (song.vocalData?.byteLength || 0);
        });

        return totalSize;
    }
}

// Lazy database initialization to prevent SSR/Worker issues
let dbInstance: AudioKaraokeDB | null = null;

// Create a mock DB that returns safe no-op values for SSR contexts
const createMockDB = (): any => ({
    models: { toArray: async () => [], clear: async () => {}, count: async () => 0, where: () => ({ equals: () => ({ first: async () => undefined, delete: async () => {} }) }), add: async () => 0, update: async () => 0, delete: async () => {} },
    cachedAudio: { toArray: async () => [], clear: async () => {}, count: async () => 0, where: () => ({ equals: () => ({ first: async () => null, delete: async () => {} }) }), orderBy: () => ({ toArray: async () => [] }), add: async () => 0, update: async () => 0, delete: async () => {} },
    processingLogs: { toArray: async () => [], clear: async () => {}, count: async () => 0, where: () => ({ equals: () => ({ first: async () => undefined, delete: async () => {} }) }), add: async () => 0, update: async () => 0, delete: async () => {} },
    audioFiles: { toArray: async () => [], clear: async () => {}, count: async () => 0, get: async () => undefined, put: async () => '', where: () => ({ equals: () => ({ first: async () => undefined, delete: async () => {} }) }), add: async () => '', update: async () => 0, delete: async () => {} },
    songs: { toArray: async () => [], clear: async () => {}, count: async () => 0, where: () => ({ equals: () => ({ first: async () => undefined, delete: async () => {} }) }), add: async () => 0, update: async () => 0, delete: async () => {} },
    playlists: { toArray: async () => [], clear: async () => {}, count: async () => 0, where: () => ({ equals: () => ({ first: async () => undefined, delete: async () => {} }) }), add: async () => 0, update: async () => 0, delete: async () => {} },
    queue: { toArray: async () => [], clear: async () => {}, count: async () => 0, where: () => ({ equals: () => ({ first: async () => undefined, delete: async () => {} }) }), add: async () => 0, update: async () => 0, delete: async () => {} },
    processingQueue: { toArray: async () => [], clear: async () => {}, count: async () => 0, where: () => ({ equals: () => ({ first: async () => undefined, delete: async () => {} }) }), add: async () => 0, update: async () => 0, delete: async () => {} },
    lyricSyncCache: { toArray: async () => [], clear: async () => {}, count: async () => 0, where: () => ({ equals: () => ({ first: async () => undefined, delete: async () => {} }) }), add: async () => 0, update: async () => 0, delete: async () => {} },
    clearAll: async () => {},
    getDatabaseSize: async () => 0,
});

export const db = new Proxy({} as AudioKaraokeDB, {
    get(target, prop) {
        // Initialize database on first access
        if (!dbInstance) {
            // Only initialize if we're in a browser context with IndexedDB
            if (typeof indexedDB !== 'undefined') {
                dbInstance = new AudioKaraokeDB();
            } else {
                // Return mock DB for SSR/non-browser contexts
                if (process.env.NODE_ENV === 'development') {
                    console.warn('[AudioKaraokeDB] Accessed during SSR - returning mock database');
                }
                const mock = createMockDB();
                return mock[prop];
            }
        }

        const value = (dbInstance as any)[prop];
        // Bind methods to the instance to ensure 'this' context is preserved
        if (typeof value === 'function') {
            return value.bind(dbInstance);
        }
        return value;
    }
});
