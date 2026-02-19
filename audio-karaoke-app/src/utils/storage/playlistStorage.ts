/**
 * Playlist storage utilities
 * Manages user-created playlists for organizing songs
 */

import { db } from './audioDatabase';
import type { Playlist, SmartPlaylistRule, SongEntry } from '@/types/storage';

export class PlaylistStorage {
    /**
     * Create a new playlist
     */
    async createPlaylist(name: string, songIds: number[] = [], type: 'manual' | 'smart' = 'manual', rules: SmartPlaylistRule[] = []): Promise<number> {
        const playlist: Playlist = {
            name,
            type,
            songIds,
            rules,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const id = await db.playlists.add(playlist);
        console.log(`✅ Created ${type} playlist: ${name}`);
        return id;
    }

    /**
     * Create a smart playlist
     */
    async createSmartPlaylist(name: string, rules: SmartPlaylistRule[]): Promise<number> {
        return this.createPlaylist(name, [], 'smart', rules);
    }

    /**
     * Get a specific playlist by ID
     */
    async getPlaylist(id: number): Promise<Playlist | undefined> {
        return await db.playlists.get(id);
    }

    /**
     * Get all playlists
     */
    async getAllPlaylists(): Promise<Playlist[]> {
        return await db.playlists.orderBy('updatedAt').reverse().toArray();
    }

    /**
     * Update a playlist
     */
    async updatePlaylist(id: number, updates: Partial<Omit<Playlist, 'id' | 'createdAt'>>): Promise<void> {
        await db.playlists.update(id, {
            ...updates,
            updatedAt: Date.now()
        });
        console.log(`✅ Updated playlist ID: ${id}`);
    }

    /**
     * Delete a playlist
     */
    async deletePlaylist(id: number): Promise<void> {
        await db.playlists.delete(id);
        console.log(`❌ Deleted playlist ID: ${id}`);
    }

    /**
     * Add a song to a playlist
     */
    async addSongToPlaylist(playlistId: number, songId: number): Promise<void> {
        const playlist = await this.getPlaylist(playlistId);
        if (!playlist) {
            throw new Error(`Playlist with ID ${playlistId} not found`);
        }

        if (!playlist.songIds.includes(songId)) {
            playlist.songIds.push(songId);
            await this.updatePlaylist(playlistId, { songIds: playlist.songIds });
            console.log(`✅ Added song ${songId} to playlist ${playlistId}`);
        }
    }

    /**
     * Remove a song from a playlist
     */
    async removeSongFromPlaylist(playlistId: number, songId: number): Promise<void> {
        const playlist = await this.getPlaylist(playlistId);
        if (!playlist) {
            throw new Error(`Playlist with ID ${playlistId} not found`);
        }

        const index = playlist.songIds.indexOf(songId);
        if (index > -1) {
            playlist.songIds.splice(index, 1);
            await this.updatePlaylist(playlistId, { songIds: playlist.songIds });
            console.log(`✅ Removed song ${songId} from playlist ${playlistId}`);
        }
    }

    /**
     * Reorder songs in a playlist
     */
    async reorderPlaylist(playlistId: number, songIds: number[]): Promise<void> {
        await this.updatePlaylist(playlistId, { songIds });
        console.log(`✅ Reordered playlist ${playlistId}`);
    }

    /**
     * Get songs for a playlist (returns song IDs)
     */
    async getPlaylistSongs(playlistId: number): Promise<number[]> {
        const playlist = await this.getPlaylist(playlistId);
        if (!playlist) return [];

        if (playlist.type === 'smart' && playlist.rules && playlist.rules.length > 0) {
            // Fetch all songs and filter
            // Note: In a larger app, we might want to index fields or use advanced querying,
            // but for client-side indexedDB with < 10k songs, memory filtering is usually fast enough.
            const allSongs = await db.songs.toArray();
            const filteredSongs = allSongs.filter(song => this.evaluateRules(song, playlist.rules!));
            return filteredSongs.map(s => s.id!);
        }

        return playlist.songIds || [];
    }

    private evaluateRules(song: SongEntry, rules: SmartPlaylistRule[]): boolean {
        // AND logic: all rules must match
        return rules.every(rule => {
            const songValue = song[rule.field as keyof SongEntry];
            if (songValue === undefined || songValue === null) return false;

            const targetValue = rule.value;

            switch (rule.operator) {
                case 'contains':
                    return String(songValue).toLowerCase().includes(String(targetValue).toLowerCase());
                case 'equals':
                    return String(songValue).toLowerCase() === String(targetValue).toLowerCase();
                case 'starts_with':
                    return String(songValue).toLowerCase().startsWith(String(targetValue).toLowerCase());
                case 'ends_with':
                    return String(songValue).toLowerCase().endsWith(String(targetValue).toLowerCase());
                case 'greater_than':
                    return Number(songValue) > Number(targetValue);
                case 'less_than':
                    return Number(songValue) < Number(targetValue);
                default:
                    return false;
            }
        });
    }

    /**
     * Check if a song is in a playlist
     */
    async isSongInPlaylist(playlistId: number, songId: number): Promise<boolean> {
        const playlist = await this.getPlaylist(playlistId);
        return playlist ? playlist.songIds.includes(songId) : false;
    }

    /**
     * Get playlist count
     */
    async getPlaylistCount(): Promise<number> {
        return await db.playlists.count();
    }
}

export const playlistStorage = new PlaylistStorage();
