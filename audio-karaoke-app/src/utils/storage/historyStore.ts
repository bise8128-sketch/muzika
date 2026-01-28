import { getAllCachedAudio, deleteCachedAudio, clearAllCachedAudio, getCachedAudio } from './audioCache';
import type { CachedAudio } from '@/types/storage';

export interface HistorySession {
    id: string; // Converted from number for UI
    fileName: string;
    date: number; // Timestamp
    duration: number; // Seconds
    fileHash: string;
}

/**
 * Get all history sessions sorted by date (newest first)
 */
export async function getHistorySessions(): Promise<HistorySession[]> {
    try {
        const cachedItems = await getAllCachedAudio();

        // Map to UI friendly format and sort
        return cachedItems
            .map(item => ({
                id: item.fileHash, // Use hash as ID for restoration
                fileName: item.fileName,
                date: item.processedAt,
                duration: item.duration,
                fileHash: item.fileHash
            }))
            .sort((a, b) => b.date - a.date);

    } catch (error) {
        console.error('Failed to load history:', error);
        return [];
    }
}

/**
 * Restore a session from history
 */
export async function restoreSession(fileHash: string): Promise<CachedAudio | null> {
    return await getCachedAudio(fileHash);
}

/**
 * Delete a specific session
 */
export async function deleteSession(fileHash: string): Promise<void> {
    await deleteCachedAudio(fileHash);
}

/**
 * Clear all history
 */
export async function clearHistory(): Promise<void> {
    await clearAllCachedAudio();
}
