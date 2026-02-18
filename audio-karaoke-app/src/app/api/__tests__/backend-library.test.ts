/**
 * Tests for /api/backend-library endpoint
 * This route proxies library requests to the Python FastAPI backend.
 */

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('next/server', () => ({
    NextResponse: {
        json: jest.fn((data: any, options?: any) => ({
            json: async () => data,
            status: options?.status || 200,
        })),
    },
}));

import { GET } from '../backend-library/route';

describe('/api/backend-library', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return library data from Python backend', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                songs: [
                    { filename: 'song1.mp3', path: 'downloads/song1.mp3', stems: {} },
                    { filename: 'song2.wav', path: 'downloads/song2.wav', stems: { vocals: 'stems/song2/vocals.wav' } },
                ],
            }),
        });

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.songs).toHaveLength(2);
        expect(data.songs[0].filename).toBe('song1.mp3');
    });

    it('should return empty library when backend has no songs', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ songs: [] }),
        });

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.songs).toHaveLength(0);
    });

    it('should return error status when Python backend fails', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
        });

        const response = await GET();
        expect(response.status).toBe(500);
    });

    it('should return 503 when Python backend is unreachable', async () => {
        mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toContain('Could not connect');
    });
});
