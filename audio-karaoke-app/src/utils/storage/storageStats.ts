import { db } from './audioDatabase';

export interface StorageStats {
    totalSize: number;
    modelSize: number;
    cacheSize: number;
    itemCount: number;
}

export async function getStorageStats(): Promise<StorageStats> {
    try {
        const models = await db.models.toArray();
        const cachedAudio = await db.cachedAudio.toArray();

        const modelSize = models.reduce((acc, m) => acc + (m.data?.byteLength || 0), 0);
        const cacheSize = cachedAudio.reduce((acc, c) => {
            const vSize = c.vocals instanceof Blob ? c.vocals.size : 0;
            const iSize = c.instrumentals instanceof Blob ? c.instrumentals.size : 0;
            return acc + vSize + iSize;
        }, 0);

        return {
            totalSize: modelSize + cacheSize,
            modelSize,
            cacheSize,
            itemCount: cachedAudio.length
        };
    } catch (error) {
        console.error('Failed to get storage stats:', error);
        return { totalSize: 0, modelSize: 0, cacheSize: 0, itemCount: 0 };
    }
}

export async function clearCache(): Promise<void> {
    await db.cachedAudio.clear();
    await db.processingLogs.clear();
}

export function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
