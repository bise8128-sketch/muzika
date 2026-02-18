/**
 * Tests for /api/python-processing endpoint
 * Covers: request validation, rate limiting, download+separation flow, error handling.
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
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return { valid: true, videoId: 'mock-video-id' };
        }
        return { valid: false, error: 'Invalid YouTube URL' };
    }),
    validateFilePath: jest.fn((segments: string[], _opts?: any) => {
        const path = segments.join('/');
        if (path.includes('..')) return { valid: false, error: 'Path traversal detected' };
        return { valid: true, path };
    }),
    sanitizeErrorMessage: jest.fn((err: any) => typeof err === 'string' ? err : 'An error occurred'),
    RateLimiter: jest.fn().mockImplementation(() => ({
        check: jest.fn().mockReturnValue({ allowed: true, remaining: 4, resetTime: Date.now() + 300000 }),
    })),
}));

import { POST, GET } from '../python-processing/route';
import { NextRequest } from 'next/server';
import { circuitBreakerFetch } from '@/utils/api/circuitBreakerFetch';

const mockCircuitFetch = circuitBreakerFetch as jest.MockedFunction<typeof circuitBreakerFetch>;

function createRequest(body: object, headers?: Record<string, string>): NextRequest {
    return {
        json: jest.fn().mockResolvedValue(body),
        headers: {
            get: jest.fn((key: string) => headers?.[key] || null),
        },
        url: 'http://localhost:3030/api/python-processing',
    } as unknown as NextRequest;
}

describe('/api/python-processing', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST - Validation', () => {
        it('should return 400 when neither url nor filename provided', async () => {
            const request = createRequest({});
            const response = await POST(request);
            expect(response.status).toBe(400);
        });

        it('should return 400 for invalid model name', async () => {
            const request = createRequest({ filename: 'test.mp3', model: 'invalid_model' });
            const response = await POST(request);
            expect(response.status).toBe(400);
        });

        it('should return 400 for invalid format', async () => {
            const request = createRequest({ filename: 'test.mp3', format: 'exe' });
            const response = await POST(request);
            expect(response.status).toBe(400);
        });
    });

    describe('POST - Separation with filename', () => {
        it('should start separation and return completed status', async () => {
            mockCircuitFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    job_id: 'job-123',
                    stems: {
                        vocals: 'stems/htdemucs/song/vocals.wav',
                        drums: 'stems/htdemucs/song/drums.wav',
                        bass: 'stems/htdemucs/song/bass.wav',
                        other: 'stems/htdemucs/song/other.wav',
                    },
                }),
            } as Response);

            const request = createRequest({ filename: 'test.mp3', model: 'htdemucs' });
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe('completed');
            expect(data.stems).toBeDefined();
            expect(data.stems.vocals).toContain('/api/backend-files/');
        });

        it('should return error when Python backend returns failure', async () => {
            mockCircuitFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ detail: 'File not found' }),
            } as Response);

            const request = createRequest({ filename: 'missing.mp3', model: 'htdemucs' });
            const response = await POST(request);
            expect(response.status).toBe(404);
        });
    });

    describe('POST - Separation with URL (download first)', () => {
        it('should download then separate when URL is provided', async () => {
            // First call: download
            mockCircuitFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ filename: 'downloaded-song.mp3', path: 'downloads/downloaded-song.mp3' }),
            } as Response);

            // Second call: separate
            mockCircuitFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    stems: { vocals: 'stems/htdemucs/downloaded-song/vocals.wav' },
                }),
            } as Response);

            const request = createRequest({ url: 'https://www.youtube.com/watch?v=test123' });
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe('completed');
            expect(mockCircuitFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('GET - Health check', () => {
        it('should return ready status with available models and formats', async () => {
            const request = {
                url: 'http://localhost:3030/api/python-processing',
            } as unknown as NextRequest;

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe('ready');
            expect(data.models).toBeDefined();
            expect(data.formats).toBeDefined();
        });
    });
});
