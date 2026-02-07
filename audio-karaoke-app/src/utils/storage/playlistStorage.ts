/**
 * Playlist storage utilities
 * Manages user-created playlists for organizing songs
 */

import { db } from './audioDatabase';
import type { Playlist } from '@/types/storage';

export class PlaylistStorage {
    /**
     * Create a new playlist
     */
    async createPlaylist(name: string, songIds: number[] = []): Promise<number> {
        const playlist: Playlist = {
            name,
            songIds,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const id = await db.playlists.add(playlist);
        console.log(`✅ Created playlist: ${name}`);
        return id;
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
        return playlist?.songIds || [];
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
