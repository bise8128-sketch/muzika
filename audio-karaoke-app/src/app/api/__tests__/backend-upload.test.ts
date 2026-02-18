/**
 * Tests for /api/backend-upload endpoint
 * This route proxies file uploads to the Python FastAPI backend.
 */

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('next/server', () => ({
    NextRequest: jest.fn().mockImplementation((url: string, init?: any) => ({
        url,
        formData: jest.fn().mockResolvedValue(init?._formData || new FormData()),
    })),
    NextResponse: {
        json: jest.fn((data: any, options?: any) => ({
            json: async () => data,
            status: options?.status || 200,
        })),
    },
}));

import { POST } from '../backend-upload/route';
import { NextRequest } from 'next/server';

describe('/api/backend-upload', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 400 when no file is provided', async () => {
        const formData = new FormData();
        const request = {
            formData: jest.fn().mockResolvedValue(formData),
        } as unknown as NextRequest;

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('No file provided');
    });

    it('should proxy upload to Python backend successfully', async () => {
        const mockFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
        const formData = new FormData();
        formData.set('file', mockFile);

        const request = {
            formData: jest.fn().mockResolvedValue(formData),
        } as unknown as NextRequest;

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'success', filename: 'test.mp3' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.filename).toBe('test.mp3');
    });

    it('should return backend error status when Python service fails', async () => {
        const mockFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
        const formData = new FormData();
        formData.set('file', mockFile);

        const request = {
            formData: jest.fn().mockResolvedValue(formData),
        } as unknown as NextRequest;

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({ detail: 'Internal server error' }),
        });

        const response = await POST(request);
        expect(response.status).toBe(500);
    });

    it('should return 500 when Python backend is unreachable', async () => {
        const mockFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
        const formData = new FormData();
        formData.set('file', mockFile);

        const request = {
            formData: jest.fn().mockResolvedValue(formData),
        } as unknown as NextRequest;

        mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const response = await POST(request);
        expect(response.status).toBe(500);
    });
});
