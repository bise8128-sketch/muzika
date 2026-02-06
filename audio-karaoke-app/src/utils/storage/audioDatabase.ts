/**
 * Dexie.js IndexedDB database configuration
 * Stores models, cached audio results, and processing logs
 */

import Dexie, { Table } from 'dexie';
import type { CachedAudio, ProcessingLog, SavedSong } from '@/types/storage';
import type { ModelStorageData } from '@/types/model';

export class AudioKaraokeDB extends Dexie {
    // Table definitions
    models!: Table<ModelStorageData, number>;
    cachedAudio!: Table<CachedAudio, number>;
    processingLogs!: Table<ProcessingLog, number>;
    songs!: Table<SavedSong, number>;

    constructor() {
        super('AudioKaraokeDB');

        // Define database schema
        // Version 3: Added songs table and updated cachedAudio indices
        this.version(3).stores({
            models: '++id, modelId, name, version, downloadedAt',
            cachedAudio: '++id, fileHash, fileName, processedAt, [fileHash+modelUsed]',
            processingLogs: '++id, fileHash, status, startedAt',
            songs: '++id, originalHash, customName, savedAt'
        });

        // Keep previous versions for migration history if needed
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
            totalSize += song.vocals.byteLength + song.instrumentals.byteLength;
        });

        return totalSize;
    }
}

// Create and export database instance
export const db = new AudioKaraokeDB();
