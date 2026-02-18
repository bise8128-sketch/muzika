/**
 * Tests for /api/extract-youtube endpoint
 * Covers: URL validation, rate limiting, download delegation, error handling.
 */

jest.mock('next/server', () => ({
    NextRequest: jest.fn(),
    NextResponse: {
        json: jest.fn((data: any, options?: any) => ({
            json: async () => data,
            status: options?.status || 200,
            headers: options?.headers || {},
        })),
    },
}));

jest.mock('@/utils/api/circuitBreakerFetch', () => ({
    circuitBreakerFetch: jest.fn(),
}));

jest.mock('@/utils/security/sanitize', () => ({
    validateYouTubeUrl: jest.fn((url: string) => {
        if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
            const videoId = url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : url.split('youtu.be/')[1];
            return { valid: true, videoId: videoId || 'mock-id' };
        }
        return { valid: false, error: 'Not a valid YouTube URL' };
    }),
    sanitizeErrorMessage: jest.fn((err: any) => typeof err === 'string' ? err : 'An error occurred'),
    RateLimiter: jest.fn().mockImplementation(() => ({
        check: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60000 }),
    })),
}));

import { POST, OPTIONS } from '../extract-youtube/route';
import { NextRequest } from 'next/server';
import { circuitBreakerFetch } from '@/utils/api/circuitBreakerFetch';

const mockCircuitFetch = circuitBreakerFetch as jest.MockedFunction<typeof circuitBreakerFetch>;

function createRequest(body: object, headers?: Record<string, string>): NextRequest {
    return {
        json: jest.fn().mockResolvedValue(body),
        headers: {
            get: jest.fn((key: string) => headers?.[key] || null),
        },
    } as unknown as NextRequest;
}

describe('/api/extract-youtube', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST - Validation', () => {
        it('should return 400 when URL is missing', async () => {
            const request = createRequest({});
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('required');
        });

        it('should return 400 for invalid YouTube URL', async () => {
            const request = createRequest({ url: 'https://not-youtube.com/video' });
            const response = await POST(request);

            expect(response.status).toBe(400);
        });

        it('should return 400 for invalid format', async () => {
            const request = createRequest({
                url: 'https://www.youtube.com/watch?v=test123',
                format: 'exe',
            });
            const response = await POST(request);

            expect(response.status).toBe(400);
        });
    });

    describe('POST - Successful download', () => {
        it('should download and return file info', async () => {
            mockCircuitFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'success',
                    filename: 'song.mp3',
                    path: 'downloads/song.mp3',
                }),
            } as Response);

            const request = createRequest({
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                format: 'mp3',
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe('success');
            expect(data.filename).toBe('song.mp3');
            expect(data.url).toContain('/api/backend-files/');
            expect(data.videoId).toBeDefined();
        });

        it('should work with short YouTube URLs', async () => {
            mockCircuitFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    filename: 'short-song.mp3',
                    path: 'downloads/short-song.mp3',
                }),
            } as Response);

            const request = createRequest({ url: 'https://youtu.be/dQw4w9WgXcQ' });
            const response = await POST(request);

            expect(response.status).toBe(200);
        });
    });

    describe('POST - Error handling', () => {
        it('should return 504 on timeout', async () => {
            const abortError = new Error('Request timed out');
            abortError.name = 'AbortError';
            mockCircuitFetch.mockRejectedValueOnce(abortError);

            const request = createRequest({ url: 'https://www.youtube.com/watch?v=test' });
            const response = await POST(request);

            expect(response.status).toBe(504);
        });

        it('should return 503 when circuit breaker is open', async () => {
            const circuitError = new Error('Circuit open');
            circuitError.name = 'CircuitOpenError';
            mockCircuitFetch.mockRejectedValueOnce(circuitError);

            const request = createRequest({ url: 'https://www.youtube.com/watch?v=test' });
            const response = await POST(request);

            expect(response.status).toBe(503);
        });

        it('should return 403 for restricted videos', async () => {
            mockCircuitFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({ detail: 'Video is restricted' }),
            } as Response);

            const request = createRequest({ url: 'https://www.youtube.com/watch?v=restricted' });
            const response = await POST(request);

            expect(response.status).toBe(403);
        });
    });

    describe('OPTIONS', () => {
        it('should be defined for CORS preflight', () => {
            expect(OPTIONS).toBeDefined();
        });
    });
});
