/**
 * Unified Repository Interfaces for Muzika Storage
 */

import type { SongEntry, Playlist, QueueState } from './storage';

export interface IRepository<T, ID = number | string> {
    get(id: ID): Promise<T | undefined>;
    getAll(): Promise<T[]>;
    create(item: T): Promise<ID>;
    update(id: ID, item: Partial<T>): Promise<void>;
    delete(id: ID): Promise<void>;
}

export interface ISongRepository extends IRepository<SongEntry, number | string> {
    getByHash(hash: string): Promise<SongEntry[]>;
    updateLastPlayed(id: number | string): Promise<void>;
}

export interface IPlaylistRepository extends IRepository<Playlist, number | string> {
    getSongs(playlistId: number | string): Promise<SongEntry[]>;
}

export interface IQueueRepository {
    getQueue(): Promise<QueueState | undefined>;
    saveQueue(queue: QueueState): Promise<void>;
}

export interface ISettingsRepository {
    getSettings(): Promise<any>;
    updateSettings(settings: any): Promise<void>;
}
