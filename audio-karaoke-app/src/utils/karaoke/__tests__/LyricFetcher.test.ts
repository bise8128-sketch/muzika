import { LyricFetcher } from '../LyricFetcher';

describe('LyricFetcher', () => {
    // Mock global fetch
    beforeAll(() => {
        global.fetch = jest.fn();
    });

    it('should search for lyrics on LRCLIB', async () => {
        const mockResponse = {
            ok: true,
            json: () => Promise.resolve({
                syncedLyrics: '[00:10.00]Hello world'
            })
        };
        (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

        const lyrics = await LyricFetcher.fetchLyrics('Artist', 'Title');
        expect(lyrics).toBe('[00:10.00]Hello world');
    });

    it('should handle 404 and fallback to search', async () => {
        // First call fails (get)
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({ ok: false, status: 404 })
            // Second call succeeds (search)
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([{
                    syncedLyrics: '[00:12.00]Search Results'
                }])
            });

        const lyrics = await LyricFetcher.fetchLyrics('Artist', 'Title');
        expect(lyrics).toBe('[00:12.00]Search Results');
    });

    it('should return null if no lyrics found', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
        
        const lyrics = await LyricFetcher.fetchLyrics('Unknown', 'Song');
        expect(lyrics).toBeNull();
    });
});
