import { db } from './audioDatabase';
import { PerformanceScore, PerformanceGrade } from '@/types/audio';

export interface PerformanceRecord {
    id?: number;
    songId: number;
    fileHash: string;
    grade: PerformanceGrade;
    score: number; // overallAccuracy
    notesHit: number;
    totalNotes: number;
    longestStreak: number;
    harmonyHits: number;
    createdAt: number;
}

export const performanceStorage = {
    /**
     * Save a new performance score record
     */
    async saveScore(songId: number, fileHash: string, score: PerformanceScore): Promise<number> {
        const record: PerformanceRecord = {
            songId,
            fileHash,
            grade: score.grade,
            score: score.overallAccuracy,
            notesHit: score.notesHit,
            totalNotes: score.totalNotes,
            longestStreak: score.longestStreak,
            harmonyHits: score.harmonyHits,
            createdAt: Date.now()
        };

        return await db.performanceHistory.add(record);
    },

    /**
     * Get the leaderboard (top scores) for a specific song
     */
    async getLeaderboard(songId: number, limit: number = 5): Promise<PerformanceRecord[]> {
        return await db.performanceHistory
            .where('songId')
            .equals(songId)
            .reverse()
            .sortBy('score')
            .then(records => records.slice(0, limit));
    },

    /**
     * Get the best performance for a specific song
     */
    async getBestScore(songId: number): Promise<PerformanceRecord | undefined> {
        const records = await this.getLeaderboard(songId, 1);
        return records[0];
    },

    /**
     * Get the best performance for a specific file hash
     */
    async getBestScoreByHash(fileHash: string): Promise<PerformanceRecord | undefined> {
        return await db.performanceHistory
            .where('fileHash')
            .equals(fileHash)
            .reverse()
            .sortBy('score')
            .then(records => records[0]);
    },

    /**
     * Get recent performance activity
     */
    async getRecentActivity(limit: number = 10): Promise<PerformanceRecord[]> {
        return await db.performanceHistory
            .orderBy('createdAt')
            .reverse()
            .limit(limit)
            .toArray();
    },

    /**
     * Delete all performance records for a song
     */
    async deleteHistoryForSong(songId: number): Promise<void> {
        await db.performanceHistory.where('songId').equals(songId).delete();
    },

    /**
     * Clear all performance history
     */
    async clearAllHistory(): Promise<void> {
        await db.performanceHistory.clear();
    }
};
