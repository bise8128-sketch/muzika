import { playlistStorage } from '../playlistStorage';
import { db } from '../audioDatabase';
import { Playlist } from '@/types/storage';

// Mock Dexie database
jest.mock('../audioDatabase', () => ({
    db: {
        playlists: {
            add: jest.fn(),
            get: jest.fn(),
            orderBy: jest.fn().mockReturnThis(),
            reverse: jest.fn().mockReturnThis(),
            toArray: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
    },
}));

describe('playlistStorage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createPlaylist', () => {
        it('should add a new playlist to the database', async () => {
            const name = 'My Playlist';
            (db.playlists.add as jest.Mock).mockResolvedValue(1);

            const id = await playlistStorage.createPlaylist(name);

            expect(id).toBe(1);
            expect(db.playlists.add).toHaveBeenCalledWith(expect.objectContaining({
                name,
                songIds: [],
                createdAt: expect.any(Number),
                updatedAt: expect.any(Number),
            }));
        });
    });

    describe('getAllPlaylists', () => {
        it('should return all playlists sorted by updated date', async () => {
            const mockPlaylists: Playlist[] = [
                { id: 1, name: 'P1', songIds: [], createdAt: 100, updatedAt: 300 },
                { id: 2, name: 'P2', songIds: [], createdAt: 200, updatedAt: 200 },
            ];
            (db.playlists.toArray as jest.Mock).mockResolvedValue(mockPlaylists);

            const result = await playlistStorage.getAllPlaylists();

            expect(result).toEqual(mockPlaylists);
            expect(db.playlists.orderBy).toHaveBeenCalledWith('updatedAt');
        });
    });

    describe('addSongToPlaylist', () => {
        it('should add a song ID to an existing playlist', async () => {
            const playlist: Playlist = { id: 1, name: 'Test', songIds: [1, 2], createdAt: 0, updatedAt: 0 };
            (db.playlists.get as jest.Mock).mockResolvedValue(playlist);
            (db.playlists.update as jest.Mock).mockResolvedValue(1);

            await playlistStorage.addSongToPlaylist(1, 3);

            expect(db.playlists.update).toHaveBeenCalledWith(1, expect.objectContaining({
                songIds: [1, 2, 3],
                updatedAt: expect.any(Number),
            }));
        });
    });
});
