import { modelStorage } from './modelStorage';
import { audioCache } from './audioCache';
import { processingLogger } from './processingLogs';

export interface StorageStats {
    totalSize: number;
    modelSize: number;
    cacheSize: number;
    itemCount: number;
}

export async function getStorageStats(): Promise<StorageStats> {
    try {
        // Use modelStorage's aggregation which covers both
        const stats = await modelStorage.getStorageStats();

        return {
            totalSize: stats.totalSize,
            modelSize: stats.modelsSize,
            cacheSize: stats.audioSize,
            itemCount: stats.cachedAudioCount
        };
    } catch (error) {
        console.error('Failed to get storage stats:', error);
        return { totalSize: 0, modelSize: 0, cacheSize: 0, itemCount: 0 };
    }
}

export async function clearCache(): Promise<void> {
    await audioCache.clearAudioCache();
    await processingLogger.clearAllLogs();
}

export function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
