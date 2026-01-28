/**
 * Dexie.js IndexedDB database configuration
 * Stores models, cached audio results, and processing logs
 */

import Dexie, { Table } from 'dexie';
import type { CachedAudio, ProcessingLog } from '@/types/storage';
import type { ModelStorageData } from '@/types/model';

export class AudioKaraokeDB extends Dexie {
    // Table definitions
    models!: Table<ModelStorageData, number>;
    cachedAudio!: Table<CachedAudio, number>;
    processingLogs!: Table<ProcessingLog, number>;

    constructor() {
        super('AudioKaraokeDB');

        // Define database schema
        this.version(1).stores({
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
    }

    /**
     * Get database size estimate
     */
    async getDatabaseSize(): Promise<number> {
        const models = await this.models.toArray();
        const audio = await this.cachedAudio.toArray();

        let totalSize = 0;

        models.forEach(model => {
            totalSize += model.size;
        });

        audio.forEach(item => {
            totalSize += item.vocals.byteLength + item.instrumentals.byteLength;
        });

        return totalSize;
    }
}

// Create and export database instance
export const db = new AudioKaraokeDB();
