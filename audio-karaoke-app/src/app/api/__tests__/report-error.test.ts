/**
 * Tests for /api/report-error endpoint
 */

// Mock console.error before anything else
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

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

import { POST } from '../report-error/route';
import { NextRequest } from 'next/server';

describe('/api/report-error', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        mockConsoleError.mockRestore();
    });

    const createMockRequest = (body: any, headers?: Record<string, string>) => {
        return {
            json: async () => body,
            headers: {
                get: jest.fn((key: string) => {
                    const defaultHeaders = {
                        'x-forwarded-for': '127.0.0.1',
                        'user-agent': 'Mozilla/5.0',
                        ...headers,
                    };
                    return defaultHeaders[key] || null;
                }),
            },
        } as unknown as NextRequest;
    };

    describe('POST - Success Cases', () => {
        it('should accept valid error report with required fields', async () => {
            const errorData = {
                message: 'Test error message',
            };

            const request = createMockRequest(errorData);
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual({ status: 'ok' });
        });

        it('should accept error report with all optional fields', async () => {
            const errorData = {
                message: 'Test error message',
                stack: 'Error: Test\n    at file.ts:10',
                component: 'AudioProcessor',
                metadata: {
                    userId: '123',
                    sessionId: 'abc',
                },
            };

            const request = createMockRequest(errorData);
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual({ status: 'ok' });
        });

        it('should log error with request metadata', async () => {
            const errorData = {
                message: 'Test error',
                stack: 'Error stack',
            };

            const request = createMockRequest(errorData, {
                'x-forwarded-for': '192.168.1.1',
                'user-agent': 'Custom User Agent',
            });

            await POST(request);

            expect(console.error).toHaveBeenCalledWith(
                '[CLIENT_ERROR_REPORT]:',
                expect.objectContaining({
                    message: 'Test error',
                    stack: 'Error stack',
                    timestamp: expect.any(String),
                    ip: '192.168.1.1',
                    userAgent: 'Custom User Agent',
                })
            );
        });
    });

    describe('POST - Validation Errors', () => {
        it('should return 400 for missing message field', async () => {
            const errorData = {
                stack: 'some stack',
            };

            const request = createMockRequest(errorData);
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data).toHaveProperty('error');
            expect(data.error).toBe('Validation failed');
        });

        it('should accept empty message string', async () => {
            const errorData = {
                message: '',
            };

            const request = createMockRequest(errorData);
            const response = await POST(request);
            const data = await response.json();

            // Zod allows empty strings by default
            expect(response.status).toBe(200);
            expect(data).toEqual({ status: 'ok' });
        });

        it('should return 400 for invalid message type', async () => {
            const errorData = {
                message: 123, // Should be string
            };

            const request = createMockRequest(errorData);
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data).toHaveProperty('error');
        });
    });

    describe('POST - Optional Fields', () => {
        it('should accept report without stack field', async () => {
            const errorData = {
                message: 'Error without stack',
            };

            const request = createMockRequest(errorData);
            const response = await POST(request);

            expect(response.status).toBe(200);
        });

        it('should accept report without component field', async () => {
            const errorData = {
                message: 'Error without component',
                stack: 'Error stack',
            };

            const request = createMockRequest(errorData);
            const response = await POST(request);

            expect(response.status).toBe(200);
        });

        it('should accept report with complex metadata', async () => {
            const errorData = {
                message: 'Error with metadata',
                metadata: {
                    nested: {
                        value: 'test',
                    },
                    array: [1, 2, 3],
                    bool: true,
                },
            };

            const request = createMockRequest(errorData);
            const response = await POST(request);

            expect(response.status).toBe(200);
        });
    });

    describe('POST - Error Handling', () => {
        it('should handle malformed JSON', async () => {
            const request = {
                json: async () => {
                    throw new Error('Invalid JSON');
                },
                headers: {
                    get: jest.fn(),
                },
            } as unknown as NextRequest;

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data).toHaveProperty('error');
        });

        it('should use default headers when custom headers not provided', async () => {
            const errorData = {
                message: 'Test error',
            };

            const request = createMockRequest(errorData, {});
            await POST(request);

            // createMockRequest provides default headers
            expect(console.error).toHaveBeenCalledWith(
                '[CLIENT_ERROR_REPORT]:',
                expect.objectContaining({
                    ip: '127.0.0.1',
                    userAgent: 'Mozilla/5.0',
                })
            );
        });
    });
});
