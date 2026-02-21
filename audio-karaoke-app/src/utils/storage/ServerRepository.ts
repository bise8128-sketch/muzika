import { ApiClient } from '../../api/ApiClient';
import type { SongEntry, Playlist } from '@/types/storage';
import type { 
    ISongRepository, 
    IPlaylistRepository, 
    IQueueRepository,
    ISettingsRepository 
} from '@/types/repository';

/**
 * Server-side implementation of repositories
 * Communicates with the PostgreSQL/Prisma backend
 */

export class ServerSongRepository implements ISongRepository {
    private api = new ApiClient();

    async get(id: string | number): Promise<SongEntry | undefined> {
        return this.api.get(`/songs/${id}`);
    }

    async getAll(): Promise<SongEntry[]> {
        return this.api.get('/songs');
    }

    async getByHash(hash: string): Promise<SongEntry[]> {
        return this.api.get(`/songs/hash/${hash}`);
    }

    async create(song: SongEntry): Promise<string | number> {
        const response = await this.api.post<{ id: string | number }>('/songs', song);
        return response.id;
    }

    async update(id: string | number, updates: Partial<SongEntry>): Promise<void> {
        await this.api.put(`/songs/${id}`, updates);
    }

    async updateLastPlayed(id: string | number): Promise<void> {
        await this.api.post(`/songs/${id}/played`, {});
    }

    async delete(id: string | number): Promise<void> {
        await this.api.delete(`/songs/${id}`);
    }
}

export class ServerPlaylistRepository implements IPlaylistRepository {
    private api = new ApiClient();

    async get(id: string | number): Promise<Playlist | undefined> {
        return this.api.get(`/playlists/${id}`);
    }

    async getAll(): Promise<Playlist[]> {
        return this.api.get('/playlists');
    }

    async create(playlist: Playlist): Promise<string | number> {
        const response = await this.api.post<{ id: string | number }>('/playlists', playlist);
        return response.id;
    }

    async update(id: string | number, updates: Partial<Playlist>): Promise<void> {
        await this.api.put(`/playlists/${id}`, updates);
    }

    async delete(id: string | number): Promise<void> {
        await this.api.delete(`/playlists/${id}`);
    }

    async getSongs(playlistId: string | number): Promise<SongEntry[]> {
        return this.api.get(`/playlists/${playlistId}/songs`);
    }
}

export class ServerQueueRepository implements IQueueRepository {
    private api = new ApiClient();

    async getQueue(): Promise<any> {
        return this.api.get('/queue');
    }

    async saveQueue(queue: any): Promise<void> {
        await this.api.post('/queue', queue);
    }
}

export class ServerSettingsRepository implements ISettingsRepository {
    private api = new ApiClient();

    async getSettings(): Promise<any> {
        return this.api.get('/settings');
    }

    async updateSettings(settings: any): Promise<void> {
        await this.api.put('/settings', settings);
    }
}
