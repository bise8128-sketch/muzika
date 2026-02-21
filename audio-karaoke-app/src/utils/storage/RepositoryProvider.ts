import { 
    IndexedDBSongRepository, 
    IndexedDBPlaylistRepository, 
    IndexedDBQueueRepository,
    LocalStorageSettingsRepository
} from './IndexedDBRepository';
import { 
    ServerSongRepository, 
    ServerPlaylistRepository, 
    ServerQueueRepository,
    ServerSettingsRepository
} from './ServerRepository';
import type { 
    ISongRepository, 
    IPlaylistRepository, 
    IQueueRepository,
    ISettingsRepository 
} from '@/types/repository';

/**
 * Service locator / Provider for repositories
 */
export class RepositoryProvider {
    private static useServer: boolean = false; // Toggle based on login/sync status

    static setUseServer(value: boolean) {
        this.useServer = value;
    }

    static get songs(): ISongRepository {
        return this.useServer ? new ServerSongRepository() : new IndexedDBSongRepository();
    }

    static get playlists(): IPlaylistRepository {
        return this.useServer ? new ServerPlaylistRepository() : new IndexedDBPlaylistRepository();
    }

    static get queue(): IQueueRepository {
        return this.useServer ? new ServerQueueRepository() : new IndexedDBQueueRepository();
    }

    static get settings(): ISettingsRepository {
        return this.useServer ? new ServerSettingsRepository() : new LocalStorageSettingsRepository();
    }

    // Explicit accessors for SyncManager to always get Server repositories
    static getServerSongs(): ISongRepository {
        return new ServerSongRepository();
    }

    static getServerPlaylists(): IPlaylistRepository {
        return new ServerPlaylistRepository();
    }

    static getServerQueue(): IQueueRepository {
        return new ServerQueueRepository();
    }
}
