import { audioCache } from './audioCache';
import { modelStorage } from './modelStorage';
import { db } from './audioDatabase';
import { StorageQuotaError, FileValidationError } from '../../errors';

export class StorageManager {
    /**
     * Perform emergency cleanup when a QuotaExceededError occurs.
     * First clears the audio cache (stems are re-calculable), then older models.
     */
    static async emergencyCleanup(): Promise<void> {
        console.warn('[StorageManager] Emergency cleanup triggered due to QuotaExceededError');
        
        // 1. Clear audio cache entirely as first line of defense
        // (Better to lose cached stems than to fail processing/loading models)
        await audioCache.clearAudioCache();
        
        // 2. Clear old models (keep only the most recent ones)
        await modelStorage.evictOldestIfNeeded(2, 0.5); // Aggressive model cleanup
        
        console.log('[StorageManager] Emergency cleanup complete');
    }

    /**
     * Check if it passes quotas.
     */
    static async validateStorage(fileSize: number): Promise<boolean> {
        if (!navigator.storage || !navigator.storage.estimate) {
            console.warn('Storage Estimation API not available, assuming space is available');
            return true;
        }

        try {
            const { quota, usage } = await navigator.storage.estimate();
            if (quota && usage) {
                const available = quota - usage;
                // Require at least fileSize + 200MB buffer
                if (available < fileSize + 200 * 1024 * 1024) {
                    throw new StorageQuotaError(`Insufficient storage space. Required: ${(fileSize / (1024*1024)).toFixed(0)}MB.`);
                }
            }
            return true;
        } catch (error) {
            const e = error as Error;
            console.warn('Failed to estimate storage:', e);
            if (e instanceof StorageQuotaError) throw e;
            return true; // Fallback to allowing if estimation fails
        }
    }

    /**
     * Get aggregated storage statistics for the UI.
     */
    static async getStats() {
        return await modelStorage.getStorageStats();
    }

    /**
     * Clear all cached audio stems.
     */
    static async clearAudioCache(): Promise<void> {
        await audioCache.clearAudioCache();
    }

    /**
     * Clear all downloaded models.
     */
    static async clearModelStorage(): Promise<void> {
        await modelStorage.clearAllModels();
    }

    /**
     * Store a file in IndexedDB.
     */
    static async storeFile(file: File, fileId: string): Promise<string> {
        try {
            // First validate storage is available
            await this.validateStorage(file.size);
            
            await db.audioFiles.put({
                id: fileId,
                data: file,
                name: file.name,
                type: file.type,
                size: file.size,
                createdAt: Date.now()
            });
            return fileId;
        } catch (error) {
            const e = error as Error;
            console.error('Failed to store file:', e);
            
            if (e.name === 'QuotaExceededError') {
                 throw new StorageQuotaError('Browser storage quota exceeded. Please clear some space.');
            }
            if (e instanceof StorageQuotaError) throw e;
            
            throw new FileValidationError(`Failed to store file in IndexedDB: ${e.message}`);
        }
    }

    /**
     * Utility to run a storage-intensive operation with retry on QuotaExceededError
     */
    static async runWithRetry<T>(operation: () => Promise<T>, label: string = 'Operation'): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof Error && (error.name === 'QuotaExceededError' || error.message.includes('QuotaExceededError'))) {
                console.warn(`[StorageManager] ${label} failed with QuotaExceededError. Retrying after cleanup...`);
                await this.emergencyCleanup();
                return await operation();
            }
            throw error;
        }
    }
}
