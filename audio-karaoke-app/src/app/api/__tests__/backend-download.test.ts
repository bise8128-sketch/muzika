/**
 * Tests for /api/backend-download endpoint
 * This route proxies download requests (YouTube URLs) to the Python backend via circuit breaker.
 */

jest.mock('next/server', () => ({
    NextResponse: {
        json: jest.fn((data: any, options?: any) => ({
            json: async () => data,
            status: options?.status || 200,
        })),
    },
}));

// Mock circuitBreakerFetch
jest.mock('@/utils/api/circuitBreakerFetch', () => ({
    circuitBreakerFetch: jest.fn(),
}));

import { POST } from '../backend-download/route';
import { NextRequest } from 'next/server';
import { circuitBreakerFetch } from '@/utils/api/circuitBreakerFetch';

const mockCircuitFetch = circuitBreakerFetch as jest.MockedFunction<typeof circuitBreakerFetch>;

function createRequest(body: object): NextRequest {
    return {
        json: jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest;
}

describe('/api/backend-download', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should proxy download request and return success', async () => {
        mockCircuitFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                status: 'success',
                filename: 'song.mp3',
                path: 'downloads/song.mp3',
            }),
        } as Response);

        const request = createRequest({
            url: 'https://www.youtube.com/watch?v=test123',
            format: 'mp3',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.filename).toBe('song.mp3');
    });

    it('should return backend error when Python service returns error', async () => {
        mockCircuitFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ detail: 'Download failed' }),
        } as Response);

        const request = createRequest({ url: 'https://invalid.example.com' });
        const response = await POST(request);

        expect(response.status).toBe(500);
    });

    it('should return 503 when circuit breaker is open', async () => {
        const circuitError = new Error('Service unavailable');
        circuitError.name = 'CircuitOpenError';
        mockCircuitFetch.mockRejectedValueOnce(circuitError);

        const request = createRequest({ url: 'https://www.youtube.com/watch?v=test' });
        const response = await POST(request);

        expect(response.status).toBe(503);
    });

    it('should return 503 when Python backend is unreachable', async () => {
        mockCircuitFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const request = createRequest({ url: 'https://www.youtube.com/watch?v=test' });
        const response = await POST(request);

        expect(response.status).toBe(503);
    });
});
