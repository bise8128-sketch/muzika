import { RepositoryProvider } from './RepositoryProvider';
import type { SongEntry, Playlist, QueueState } from '@/types/storage';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export class SyncManager {
    private static instance: SyncManager;
    private status: SyncStatus = 'idle';
    private listeners: ((status: SyncStatus) => void)[] = [];

    private constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.syncAll());
            window.addEventListener('offline', () => this.setStatus('offline'));
            window.addEventListener('muzika-data-change', () => this.syncAll());
            
            if (navigator.onLine) {
                this.syncAll();
            } else {
                this.setStatus('offline');
            }
        }
    }

    static getInstance(): SyncManager {
        if (!SyncManager.instance) {
            SyncManager.instance = new SyncManager();
        }
        return SyncManager.instance;
    }

    getStatus(): SyncStatus {
        return this.status;
    }

    subscribe(listener: (status: SyncStatus) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private setStatus(status: SyncStatus) {
        this.status = status;
        this.listeners.forEach(l => l(status));
    }

    /**
     * Orchestrate synchronization for all entities
     */
    async syncAll() {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            this.setStatus('offline');
            return;
        }

        if (this.status === 'syncing') return;

        console.log('🔄 Starting full data synchronization...');
        this.setStatus('syncing');

        try {
            await Promise.all([
                this.syncSongs(),
                this.syncPlaylists(),
                this.syncQueue()
            ]);
            
            console.log('✅ Synchronization complete.');
            this.setStatus('idle');
        } catch (error) {
            console.error('❌ Synchronization failed:', error);
            this.setStatus('error');
        }
    }

    private async syncSongs() {
        const localSongs = await RepositoryProvider.songs.getAll();
        const dirtySongs = localSongs.filter((s: SongEntry) => s.isDirty);

        if (dirtySongs.length === 0) return;

        console.log(`📡 Syncing ${dirtySongs.length} songs...`);

        for (const song of dirtySongs) {
            try {
                if (song.serverId) {
                    await RepositoryProvider.getServerSongs().update(song.serverId, song);
                } else {
                    const serverId = await RepositoryProvider.getServerSongs().create(song);
                    song.serverId = serverId;
                }
                
                await RepositoryProvider.songs.update(song.id!, {
                    isDirty: false,
                    serverSyncedAt: Date.now(),
                    serverId: song.serverId
                });
            } catch (e) {
                console.error(`Failed to sync song ${song.id}:`, e);
            }
        }
    }

    private async syncPlaylists() {
        const localPlaylists = await RepositoryProvider.playlists.getAll();
        const dirtyPlaylists = localPlaylists.filter(p => p.isDirty);

        if (dirtyPlaylists.length === 0) return;

        for (const playlist of dirtyPlaylists) {
            try {
                if (playlist.serverId) {
                    await RepositoryProvider.getServerPlaylists().update(playlist.serverId, playlist);
                } else {
                    const serverId = await RepositoryProvider.getServerPlaylists().create(playlist);
                    playlist.serverId = serverId;
                }

                await RepositoryProvider.playlists.update(playlist.id!, {
                    isDirty: false,
                    serverSyncedAt: Date.now(),
                    serverId: playlist.serverId
                });
            } catch (e) {
                console.error(`Failed to sync playlist ${playlist.id}:`, e);
            }
        }
    }

    private async syncQueue() {
        const queue = await RepositoryProvider.queue.getQueue();
        if (queue && queue.isDirty) {
            try {
                await RepositoryProvider.getServerQueue().saveQueue(queue);
                await RepositoryProvider.queue.saveQueue({
                    ...queue,
                    isDirty: false,
                    serverSyncedAt: Date.now()
                });
            } catch (e) {
                console.error('Failed to sync queue:', e);
            }
        }
    }
}
