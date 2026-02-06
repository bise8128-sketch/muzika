/**
 * Songs storage utilities
 * Manages user-saved song versions with custom pitch/tempo settings
 */

import { db } from './audioDatabase';
import type { SavedSong } from '@/types/storage';
import { audioCache } from './audioCache';

export class SongsStorage {
    /**
     * Save a new song version
     */
    async saveSongVersion(
        file: File,
        vocals: ArrayBuffer,
        instrumentals: ArrayBuffer,
        pitch: number,
        tempo: number,
        name: string,
        modelUsed: string
    ): Promise<number> {
        const fileHash = await audioCache.hashFile(file);

        const songData: SavedSong = {
            originalHash: fileHash,
            customName: name,
            fileName: file.name,
            pitch,
            tempo,
            vocals,
            instrumentals,
            modelUsed,
            savedAt: Date.now()
        };

        const id = await db.songs.add(songData);
        console.log(`✅ Saved song version: ${name}`);
        return id;
    }

    /**
     * Get a specific saved song
     */
    async getSong(id: number): Promise<SavedSong | undefined> {
        return await db.songs.get(id);
    }

    /**
     * Get all saved songs
     */
    async getAllSongs(): Promise<SavedSong[]> {
        return await db.songs.orderBy('savedAt').reverse().toArray();
    }

    /**
     * Get all saved versions for a specific original file
     */
    async getSongsForFile(fileHash: string): Promise<SavedSong[]> {
        return await db.songs.where('originalHash').equals(fileHash).toArray();
    }

    /**
     * Delete a saved song
     */
    async deleteSong(id: number): Promise<void> {
        await db.songs.delete(id);
        console.log(`❌ Deleted saved song ID: ${id}`);
    }

    /**
     * Update a saved song's name
     */
    async updateSongName(id: number, newName: string): Promise<void> {
        await db.songs.update(id, { customName: newName });
    }
}

export const songsStorage = new SongsStorage();
