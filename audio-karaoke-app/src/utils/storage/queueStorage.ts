/**
 * Queue storage utilities
 * Manages playback queue state with persistence
 */

import { db } from './audioDatabase';
import type { QueueState } from '@/types/storage';

const QUEUE_ID = 1; // Single queue entry for the app

export class QueueStorage {
    /**
     * Save the current queue state
     */
    async saveQueue(state: Omit<QueueState, 'id' | 'updatedAt'>): Promise<void> {
        const queueState: QueueState = {
            ...state,
            updatedAt: Date.now()
        };

        await db.queue.put(queueState, QUEUE_ID);
        console.log(`✅ Saved queue state: ${state.songIds.length} songs`);
    }

    /**
     * Load the current queue state
     */
    async loadQueue(): Promise<QueueState | undefined> {
        return await db.queue.get(QUEUE_ID);
    }

    /**
     * Clear the queue
     */
    async clearQueue(): Promise<void> {
        await db.queue.delete(QUEUE_ID);
        console.log('✅ Cleared queue');
    }

    /**
     * Get the current queue state or return default
     */
    async getQueueOrDefault(): Promise<QueueState> {
        const queue = await this.loadQueue();
        return queue || {
            songIds: [],
            currentIndex: -1,
            shuffleMode: 'off',
            repeatMode: 'off',
            updatedAt: Date.now()
        };
    }

    /**
     * Update queue songs
     */
    async updateQueueSongs(songIds: number[]): Promise<void> {
        const current = await this.getQueueOrDefault();
        await this.saveQueue({
            songIds,
            currentIndex: current.currentIndex,
            shuffleMode: current.shuffleMode,
            repeatMode: current.repeatMode
        });
    }

    /**
     * Update current index
     */
    async updateCurrentIndex(index: number): Promise<void> {
        const current = await this.getQueueOrDefault();
        await this.saveQueue({
            songIds: current.songIds,
            currentIndex: index,
            shuffleMode: current.shuffleMode,
            repeatMode: current.repeatMode
        });
    }

    /**
     * Update shuffle mode
     */
    async updateShuffleMode(mode: 'off' | 'on'): Promise<void> {
        const current = await this.getQueueOrDefault();
        await this.saveQueue({
            songIds: current.songIds,
            currentIndex: current.currentIndex,
            shuffleMode: mode,
            repeatMode: current.repeatMode
        });
    }

    /**
     * Update repeat mode
     */
    async updateRepeatMode(mode: 'off' | 'all' | 'one'): Promise<void> {
        const current = await this.getQueueOrDefault();
        await this.saveQueue({
            songIds: current.songIds,
            currentIndex: current.currentIndex,
            shuffleMode: current.shuffleMode,
            repeatMode: mode
        });
    }

    /**
     * Add song to queue
     */
    async addSongToQueue(songId: number): Promise<void> {
        const current = await this.getQueueOrDefault();
        const songIds = [...current.songIds, songId];
        await this.saveQueue({
            songIds,
            currentIndex: current.currentIndex,
            shuffleMode: current.shuffleMode,
            repeatMode: current.repeatMode
        });
    }

    /**
     * Add multiple songs to queue immediately after current song (Play Next)
     */
    async addSongsToQueueNext(newSongIds: number[]): Promise<void> {
        const current = await this.getQueueOrDefault();
        const songIds = [...current.songIds];
        
        // Insert after current index
        const insertIndex = current.currentIndex + 1;
        songIds.splice(insertIndex, 0, ...newSongIds);

        await this.saveQueue({
            songIds,
            currentIndex: current.currentIndex,
            shuffleMode: current.shuffleMode,
            repeatMode: current.repeatMode
        });
        
        console.log(`✅ Added ${newSongIds.length} songs to play next`);
    }

    /**
     * Remove song from queue by index
     */
    async removeSongFromQueue(index: number): Promise<void> {
        const current = await this.getQueueOrDefault();
        const songIds = current.songIds.filter((_, i) => i !== index);

        // Adjust current index if needed
        let currentIndex = current.currentIndex;
        if (index < currentIndex) {
            currentIndex--;
        } else if (index === currentIndex) {
            currentIndex = -1;
        }

        await this.saveQueue({
            songIds,
            currentIndex,
            shuffleMode: current.shuffleMode,
            repeatMode: current.repeatMode
        });
    }

    /**
     * Reorder queue
     */
    async reorderQueue(songIds: number[]): Promise<void> {
        const current = await this.getQueueOrDefault();
        await this.saveQueue({
            songIds,
            currentIndex: current.currentIndex,
            shuffleMode: current.shuffleMode,
            repeatMode: current.repeatMode
        });
    }
}

export const queueStorage = new QueueStorage();
