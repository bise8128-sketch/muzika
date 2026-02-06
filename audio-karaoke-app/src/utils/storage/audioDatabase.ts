/**
 * Dexie.js IndexedDB database configuration
 * Stores models, cached audio results, and processing logs
 */

import Dexie, { Table } from 'dexie';
import type { CachedAudio, ProcessingLog, SongEntry } from '@/types/storage';
import type { ModelStorageData } from '@/types/model';

export class AudioKaraokeDB extends Dexie {
    // Table definitions
    models!: Table<ModelStorageData, number>;
    cachedAudio!: Table<CachedAudio, number>;
    processingLogs!: Table<ProcessingLog, number>;
    songs!: Table<SongEntry, number>;

    constructor() {
        super('AudioKaraokeDB');

        // Define database schema
        // Version 4: Updated songs table for unified library
        this.version(4).stores({
            models: '++id, modelId, name, version, downloadedAt',
            cachedAudio: '++id, fileHash, fileName, processedAt, [fileHash+modelUsed]',
            processingLogs: '++id, fileHash, status, startedAt',
            songs: '++id, type, title, artist, versionName, originalHash, createdAt, lastPlayedAt'
        });

        // Keep previous versions for migration history if needed
        this.version(3).stores({
            models: '++id, modelId, name, version, downloadedAt',
            cachedAudio: '++id, fileHash, fileName, processedAt, [fileHash+modelUsed]',
            processingLogs: '++id, fileHash, status, startedAt',
            songs: '++id, originalHash, customName, savedAt'
        }).upgrade(trans => {
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
            totalSize += song.instrumentalData.byteLength + (song.vocalData?.byteLength || 0);
        });

        return totalSize;
    }
}

// Create and export database instance
export const db = new AudioKaraokeDB();
