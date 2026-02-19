/**
 * Songs storage utilities
 * Manages user-saved song versions with custom pitch/tempo settings
 * Supports both AI-separated tracks and direct karaoke uploads
 */

import { db } from './audioDatabase';
import type { SongEntry } from '@/types/storage';
import { audioCache } from './audioCache';
import * as mm from 'music-metadata-browser';
import { ExtractedMetadata } from '@/types/schema';
import { fileSystem } from './fileSystem';

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
        // Save tracks to OPFS
        const folder = `songs/${originalHash}_${Date.now()}`;
        const instrumentalPath = await fileSystem.saveFile(`${folder}/instrumental.wav`, instrumentals);
        const vocalPath = await fileSystem.saveFile(`${folder}/vocals.wav`, vocals);

        const songData: SongEntry = {
            type: 'ai_separated',
            title: fileName, 
            versionName,
            originalHash,
            pitchAdjustment: pitch,
            tempoMultiplier: tempo,
            instrumentalPath,
            vocalPath,
            duration,
            createdAt: Date.now()
        };

        const id = await db.songs.add(songData);
        console.log(`✅ Saved AI song version to OPFS: ${versionName}`);
        return id;
    }

    /**
     * Save a direct karaoke upload (bypassing separation)
     */
    async saveDirectKaraoke(file: File, providedMetadata?: ExtractedMetadata): Promise<number> {
        const arrayBuffer = await file.arrayBuffer();
        let metadata;

        if (providedMetadata) {
            metadata = {
                common: {
                    title: providedMetadata.title,
                    artist: providedMetadata.artist,
                    album: providedMetadata.album,
                    year: providedMetadata.year,
                    genre: providedMetadata.genre,
                    picture: providedMetadata.picture ? [{
                        format: providedMetadata.picture.format,
                        data: providedMetadata.picture.data
                    }] : undefined
                },
                format: {
                    duration: providedMetadata.duration
                }
            };
        } else {
            try {
                metadata = await mm.parseBlob(file);
            } catch (e) {
                console.warn('Failed to parse metadata:', e);
                metadata = { common: {}, format: {} };
            }
        }

        const fileHash = await audioCache.hashFile(file);
        
        // Save to OPFS
        const timestamp = Date.now();
        const instrumentalPath = await fileSystem.saveFile(`songs/${fileHash}_${timestamp}/original.wav`, arrayBuffer);

        const newEntry: SongEntry = {
            type: 'direct_karaoke',
            title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ""),
            artist: metadata.common.artist,
            album: metadata.common.album,
            genre: metadata.common.genre,
            year: metadata.common.year,
            versionName: 'Original Upload',
            instrumentalPath,
            originalHash: fileHash,
            pitchAdjustment: 0,
            tempoMultiplier: 1.0,
            duration: metadata.format.duration || 0,
            createdAt: timestamp
        };

        const id = await db.songs.add(newEntry);
        console.log(`✅ Saved direct karaoke to OPFS: ${newEntry.title}`);
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
    async updateLastPlayed(id: number): Promise<void> {
        await db.songs.update(id, { lastPlayedAt: Date.now() });
    }

    /**
     * Clean up files when deleting a song
     */
    async deleteSong(id: number): Promise<void> {
        const song = await this.getSong(id);
        if (song) {
            if (song.instrumentalPath) await fileSystem.deleteFile(song.instrumentalPath);
            if (song.vocalPath) await fileSystem.deleteFile(song.vocalPath);
        }
        await db.songs.delete(id);
        console.log(`❌ Deleted saved song ID: ${id} and associated files`);
    }

    /**
     * Migrate existing songs from IndexedDB buffers to OPFS files
     */
    async migrateToOpfs(): Promise<{ migrated: number, failed: number }> {
        const songs = await db.songs.toArray();
        let migrated = 0;
        let failed = 0;

        for (const song of songs) {
            // Already migrated or not needing migration
            if (song.instrumentalPath) continue;
            
            // Legacy entries should have buffers
            if (!song.instrumentalData) continue;

            try {
                const folder = `songs/${song.originalHash}_${song.createdAt}_migrated`;
                
                const instrumentalPath = await fileSystem.saveFile(
                    `${folder}/instrumental.wav`, 
                    song.instrumentalData
                );
                
                let vocalPath;
                if (song.vocalData) {
                    vocalPath = await fileSystem.saveFile(
                        `${folder}/vocals.wav`, 
                        song.vocalData
                    );
                }

                // Update DB entry, removing buffers and adding paths
                await db.songs.update(song.id!, {
                    instrumentalPath,
                    vocalPath,
                    instrumentalData: undefined,
                    vocalData: undefined
                });

                migrated++;
            } catch (error) {
                console.error(`❌ Migration failed for song ${song.id}:`, error);
                failed++;
            }
        }

        if (migrated > 0) {
            console.log(`📦 Storage Migration Complete: ${migrated} songs moved to OPFS.`);
        }
        return { migrated, failed };
    }
}

export const songsStorage = new SongsStorage();
