/**
 * Songs storage utilities
 * Manages user-saved song versions with custom pitch/tempo settings
 * Supports both AI-separated tracks and direct karaoke uploads
 */

import { db } from './audioDatabase';
import type { SongEntry } from '@/types/storage';
import { audioCache } from './audioCache';
import * as mm from 'music-metadata-browser';

export class SongsStorage {
    /**
     * Save a new AI-separated song version
     */
    async saveSongVersion(
        originalHash: string,
        fileName: string,
        vocals: ArrayBuffer,
        instrumentals: ArrayBuffer,
        pitch: number,
        tempo: number,
        versionName: string,
        duration: number = 0
    ): Promise<number> {
        const songData: SongEntry = {
            type: 'ai_separated',
            title: fileName, // Default title, user can update later
            versionName,
            originalHash,
            pitchAdjustment: pitch,
            tempoMultiplier: tempo,
            instrumentalData: instrumentals,
            vocalData: vocals,
            duration,
            createdAt: Date.now()
        };

        const id = await db.songs.add(songData);
        console.log(`✅ Saved AI song version: ${versionName}`);
        return id;
    }

    /**
     * Save a direct karaoke upload (bypassing separation)
     */
    async saveDirectKaraoke(file: File): Promise<number> {
        const arrayBuffer = await file.arrayBuffer();
        let metadata;

        try {
            metadata = await mm.parseBlob(file);
        } catch (e) {
            console.warn('Failed to parse metadata:', e);
            metadata = { common: {}, format: {} };
        }

        const fileHash = await audioCache.hashFile(file);

        const newEntry: SongEntry = {
            type: 'direct_karaoke',
            title: metadata.common.title || file.name,
            artist: metadata.common.artist,
            versionName: 'Original Upload',
            instrumentalData: arrayBuffer,
            originalHash: fileHash,
            pitchAdjustment: 0,
            tempoMultiplier: 1.0,
            duration: metadata.format.duration || 0,
            createdAt: Date.now()
        };

        const id = await db.songs.add(newEntry);
        console.log(`✅ Saved direct karaoke: ${newEntry.title}`);
        return id;
    }

    /**
     * Get a specific saved song
     */
    async getSong(id: number): Promise<SongEntry | undefined> {
        return await db.songs.get(id);
    }

    /**
     * Get all saved songs
     */
    async getAllSongs(): Promise<SongEntry[]> {
        return await db.songs.orderBy('createdAt').reverse().toArray();
    }

    /**
     * Get all saved versions for a specific original file
     */
    async getSongsForFile(fileHash: string): Promise<SongEntry[]> {
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
     * Update a saved song's details
     */
    async updateSongDetails(id: number, details: Partial<Pick<SongEntry, 'title' | 'artist' | 'versionName'>>): Promise<void> {
        await db.songs.update(id, details);
    }

    /**
     * Update last played timestamp
     */
    async updateLastPlayed(id: number): Promise<void> {
        await db.songs.update(id, { lastPlayedAt: Date.now() });
    }
}

export const songsStorage = new SongsStorage();
