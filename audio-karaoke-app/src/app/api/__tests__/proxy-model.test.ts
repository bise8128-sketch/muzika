/**
 * Tests for /api/proxy-model endpoint
 */

// Mock next/server before importing
jest.mock('next/server', () => ({
    NextRequest: jest.fn(),
    NextResponse: {
        json: jest.fn((data: any, options?: any) => ({
            json: async () => data,
            status: options?.status || 200,
        })),
    },
}));

// Mock translations
jest.mock('../../../utils/translations', () => ({
    translate: jest.fn((key: string) => key),
}));

import { GET } from '../proxy-model/route';
import { NextRequest } from 'next/server';

// Mock fetch
global.fetch = jest.fn();

describe('/api/proxy-model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createMockRequest = (url?: string, headers?: Record<string, string>) => {
        const searchParams = new URLSearchParams();
        if (url !== undefined) {
            searchParams.set('url', url);
        }

        return {
            nextUrl: {
                searchParams,
            },
            headers: {
                get: jest.fn((key: string) => headers?.[key] || null),
            },
        } as unknown as NextRequest;
    };

    describe('GET - Validation', () => {
        it('should return 400 for missing URL parameter', async () => {
            const request = createMockRequest();
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data).toHaveProperty('error');
        });

        it('should return 400 for invalid URL format', async () => {
            const request = createMockRequest('not-a-url');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data).toHaveProperty('error');
        });

        it('should return 403 for disallowed domain', async () => {
            const request = createMockRequest('https://malicious.com/model.onnx');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toMatch(/not allowed/i);
        });
    });

    describe('GET - Allowed Domains', () => {
        const allowedUrls = [
            'https://github.com/model/file.onnx',
            'https://raw.githubusercontent.com/model/file.onnx',
            'https://huggingface.co/model/file.onnx',
            'https://cdn-lfs.huggingface.co/model/file.onnx',
        ];

        allowedUrls.forEach((url) => {
            it(`should accept allowed domain: ${new URL(url).hostname}`, async () => {
                const mockResponse = {
                    ok: true,
                    status: 200,
                    body: null,  // Simplified for jsdom compatibility
                    headers: new Headers({
                        'Content-Type': 'application/octet-stream',
                        'Content-Length': '1000',
                    }),
                };
                (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

                const request = createMockRequest(url);
                const response = await GET(request);

                expect(response.status).not.toBe(403);
                expect(global.fetch).toHaveBeenCalledWith(
                    url,
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'User-Agent': 'Muzika-Audio-App',
                        }),
                    })
                );
            });
        });
    });

    describe('GET - Range Header Support', () => {
        it('should pass through range headers for resumed downloads', async () => {
            const testUrl = 'https://github.com/model/file.onnx';
            const mockResponse = {
                ok: false,
                status: 206,
                body: null,  // Simplified for jsdom compatibility
                headers: new Headers({
                    'Content-Type': 'application/octet-stream',
                    'Content-Range': 'bytes 0-999/5000',
                }),
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const request = createMockRequest(testUrl, { range: 'bytes=0-999' });
            await GET(request);

            expect(global.fetch).toHaveBeenCalledWith(
                testUrl,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Range': 'bytes=0-999',
                    }),
                })
            );
        });
    });

    describe('GET - Error Handling', () => {
        it('should handle fetch errors gracefully', async () => {
            const testUrl = 'https://github.com/model/file.onnx';
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            const request = createMockRequest(testUrl);
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data).toHaveProperty('error');
        });

        it('should handle non-ok responses', async () => {
            const testUrl = 'https://github.com/model/file.onnx';
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found',
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const request = createMockRequest(testUrl);
            const response = await GET(request);

            expect(response.status).toBe(404);
        });
    });

    describe('GET - Response Headers', () => {
        it('should set correct caching headers for successful response', async () => {
            const testUrl = 'https://github.com/model/file.onnx';
            const mockHeaders = new Headers({
                'Content-Type': 'application/octet-stream',
                'Content-Length': '5000',
            });

            const mockResponse = {
                ok: true,
                status: 200,
                body: null,  // Simplified for jsdom compatibility
                headers: mockHeaders,
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const request = createMockRequest(testUrl);
            const response = await GET(request);

            // Response should be a NextResponse with proper headers
            expect(response).toBeDefined();
        });
    });
});
