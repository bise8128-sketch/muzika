import { db } from './audioDatabase';
import type { SongEntry, Playlist, QueueState, SmartPlaylistRule } from '@/types/storage';
import type { 
    ISongRepository, 
    IPlaylistRepository, 
    IQueueRepository,
    ISettingsRepository 
} from '@/types/repository';
import type { UserSettings } from './settingsStore';
import { getSettings, saveSettings } from './settingsStore';

/**
 * IndexedDB implementation of Song Repository
 */
export class IndexedDBSongRepository implements ISongRepository {
    async get(id: number | string): Promise<SongEntry | undefined> {
        return await db.songs.get(Number(id));
    }

    async getAll(): Promise<SongEntry[]> {
        return await db.songs.orderBy('createdAt').reverse().toArray();
    }

    async getByHash(hash: string): Promise<SongEntry[]> {
        return await db.songs.where('originalHash').equals(hash).toArray();
    }

    async create(song: SongEntry): Promise<number> {
        const id = await db.songs.add({ ...song, isDirty: true });
        this.triggerSync();
        return id;
    }

    async update(id: number | string, updates: Partial<SongEntry>): Promise<void> {
        await db.songs.update(Number(id), { ...updates, isDirty: true });
        this.triggerSync();
    }

    private triggerSync() {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('muzika-data-change'));
        }
    }

    async updateLastPlayed(id: number | string): Promise<void> {
        const songId = Number(id);
        const song = await this.get(songId);
        await db.songs.update(songId, { 
            lastPlayedAt: Date.now(), 
            playCount: (song?.playCount || 0) + 1 
        });
    }

    async delete(id: number | string): Promise<void> {
        await db.songs.delete(Number(id));
    }
}

/**
 * IndexedDB implementation of Playlist Repository
 */
export class IndexedDBPlaylistRepository implements IPlaylistRepository {
    async get(id: number | string): Promise<Playlist | undefined> {
        return await db.playlists.get(Number(id));
    }

    async getAll(): Promise<Playlist[]> {
        return await db.playlists.orderBy('updatedAt').reverse().toArray();
    }

    async create(playlist: Playlist): Promise<number> {
        const id = await db.playlists.add({ ...playlist, isDirty: true });
        this.triggerSync();
        return id;
    }

    async update(id: number | string, updates: Partial<Playlist>): Promise<void> {
        await db.playlists.update(Number(id), {
            ...updates,
            isDirty: true,
            updatedAt: Date.now()
        });
        this.triggerSync();
    }

    private triggerSync() {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('muzika-data-change'));
        }
    }

    async delete(id: number | string): Promise<void> {
        await db.playlists.delete(Number(id));
    }

    async getSongs(playlistId: number | string): Promise<SongEntry[]> {
        const playlist = await this.get(playlistId);
        if (!playlist) return [];

        if (playlist.type === 'smart') {
            const allSongs = await db.songs.toArray();
            return allSongs.filter(song => this.evaluateRules(song, playlist.rules || []));
        }

        const songResults = await Promise.all(playlist.songIds.map(id => db.songs.get(id)));
        return songResults.filter((s): s is SongEntry => !!s);
    }

    private evaluateRules(song: SongEntry, rules: SmartPlaylistRule[]): boolean {
        return rules.every(rule => {
            const songValue = (song as Record<string, any>)[rule.field];
            if (songValue === undefined || songValue === null) return false;
            
            const targetValue = rule.value;
            const sVal = String(songValue).toLowerCase();
            const tVal = String(targetValue).toLowerCase();

            switch (rule.operator) {
                case 'contains': return sVal.includes(tVal);
                case 'equals': return sVal === tVal;
                case 'starts_with': return sVal.startsWith(tVal);
                case 'ends_with': return sVal.endsWith(tVal);
                case 'greater_than': return Number(songValue) > Number(targetValue);
                case 'less_than': return Number(songValue) < Number(targetValue);
                case 'not_contains': return !sVal.includes(tVal);
                case 'is_not': return sVal !== tVal;
                default: return false;
            }
        });
    }
}

/**
 * IndexedDB implementation of Queue Repository
 */
export class IndexedDBQueueRepository implements IQueueRepository {
    async getQueue(): Promise<QueueState | undefined> {
        return await db.queue.toCollection().last();
    }

    async saveQueue(queue: QueueState): Promise<void> {
        await db.queue.clear();
        await db.queue.add({
            ...queue,
            isDirty: true,
            updatedAt: Date.now()
        });
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('muzika-data-change'));
        }
    }
}

/**
 * LocalStorage implementation of Settings Repository
 */
export class LocalStorageSettingsRepository implements ISettingsRepository {
    async getSettings(): Promise<UserSettings> {
        return getSettings();
    }

    async updateSettings(settings: Partial<UserSettings>): Promise<void> {
        saveSettings(settings);
    }
}
