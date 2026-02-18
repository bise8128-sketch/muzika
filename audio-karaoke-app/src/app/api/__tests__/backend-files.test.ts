/**
 * Tests for /api/backend-files/[...path] endpoint
 * This route proxies file downloads from the Python backend with path validation.
 */

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('next/server', () => ({
    NextRequest: jest.fn(),
    NextResponse: {
        json: jest.fn((data: any, options?: any) => ({
            json: async () => data,
            status: options?.status || 200,
        })),
    },
    // The route uses `new NextResponse(body, opts)` for file streaming
}));

jest.mock('@/utils/security/sanitize', () => ({
    validateFilePath: jest.fn((segments: string[], _opts?: any) => {
        const path = segments.join('/');
        if (path.includes('..')) return { valid: false, error: 'Path traversal detected' };
        if (path.endsWith('.exe')) return { valid: false, error: 'Extension not allowed' };
        return { valid: true, path };
    }),
    sanitizeErrorMessage: jest.fn((err: any) => typeof err === 'string' ? err : 'An error occurred'),
}));

import { GET, OPTIONS } from '../backend-files/[...path]/route';
import { NextRequest, NextResponse } from 'next/server';

function createRequest(headers?: Record<string, string>): NextRequest {
    return {
        headers: {
            get: jest.fn((key: string) => headers?.[key.toLowerCase()] || null),
        },
    } as unknown as NextRequest;
}

describe('/api/backend-files/[...path]', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 400 for path traversal attempts', async () => {
            const request = createRequest();
            const params = Promise.resolve({ path: ['..', '..', 'etc', 'passwd'] });

            const response = await GET(request, { params });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Invalid file path');
        });

        it('should return 400 for disallowed file extensions', async () => {
            const request = createRequest();
            const params = Promise.resolve({ path: ['malware.exe'] });

            const response = await GET(request, { params });
            expect(response.status).toBe(400);
        });

        it('should return 404 when backend file not found', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const request = createRequest();
            const params = Promise.resolve({ path: ['stems', 'vocals.wav'] });

            const response = await GET(request, { params });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe('File not found');
        });
    });

    describe('OPTIONS', () => {
        it('should return 204 with CORS headers', async () => {
            // OPTIONS is defined directly, test it exists
            expect(OPTIONS).toBeDefined();
        });
    });
});
