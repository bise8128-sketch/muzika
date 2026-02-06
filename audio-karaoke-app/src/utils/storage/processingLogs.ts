/**
 * Processing logs storage
 * Tracks the status and progress of audio separation jobs
 */

import { db } from './audioDatabase';
import type { ProcessingLog } from '@/types/storage';

export class ProcessingLogger {
    /**
     * Create a log for a new processing job
     */
    async startProcessing(fileHash: string, fileName?: string): Promise<number> {
        const logData: ProcessingLog = {
            fileHash,
            fileName,
            status: 'processing',
            progress: 0,
            startedAt: Date.now(),
        };

        const id = await db.processingLogs.add(logData);
        return id;
    }

    /**
     * Update progress of a job
     */
    async updateProgress(logId: number, progress: number): Promise<void> {
        await db.processingLogs.update(logId, {
            progress: Math.min(100, progress),
        });
    }

    /**
     * Mark job as complete
     */
    async markComplete(logId: number): Promise<void> {
        await db.processingLogs.update(logId, {
            status: 'completed',
            progress: 100,
            completedAt: Date.now(),
        });
    }

    /**
     * Mark job as failed
     */
    async markFailed(logId: number, error: string): Promise<void> {
        await db.processingLogs.update(logId, {
            status: 'failed',
            errorMessage: error,
            completedAt: Date.now(),
        });
    }

    /**
     * Get a specific log entry
     */
    async getLog(logId: number): Promise<ProcessingLog | undefined> {
        return await db.processingLogs.get(logId);
    }

    /**
     * Get all logs for a specific file
     */
    async getLogsForFile(fileHash: string): Promise<ProcessingLog[]> {
        return await db.processingLogs.where('fileHash').equals(fileHash).toArray();
    }

    /**
     * Get all logs
     */
    async getAllLogs(): Promise<ProcessingLog[]> {
        return await db.processingLogs.toArray();
    }

    /**
     * Delete old logs (older than N days)
     */
    async deleteLogs(olderThanDays: number = 30): Promise<void> {
        const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

        await db.processingLogs
            .where('startedAt')
            .below(cutoffTime)
            .delete();

        console.log(`🗑️ Deleted logs older than ${olderThanDays} days`);
    }

    /**
     * Clear all logs
     */
    async clearAllLogs(): Promise<void> {
        await db.processingLogs.clear();
    }
}

export const processingLogger = new ProcessingLogger();
