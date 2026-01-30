/**
 * Tests for /api/models endpoint
 */

import { GET, AVAILABLE_MODELS } from '../models/route';
import { NextResponse } from 'next/server';

// Mock NextResponse
jest.mock('next/server', () => ({
    NextResponse: {
        json: jest.fn((data, options) => ({
            json: async () => data,
            headers: options?.headers || {},
            status: 200,
        })),
    },
}));

describe('/api/models', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 200 status', async () => {
            const response = await GET();
            expect(response).toBeDefined();
        });

        it('should return correct response structure', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data).toHaveProperty('models');
            expect(data).toHaveProperty('total');
            expect(data).toHaveProperty('lastUpdated');
            expect(data).toHaveProperty('status');
        });

        it('should return array of models', async () => {
            const response = await GET();
            const data = await response.json();

            expect(Array.isArray(data.models)).toBe(true);
            expect(data.models.length).toBeGreaterThan(0);
            expect(data.total).toBe(data.models.length);
        });

        it('should include required fields for each model', async () => {
            const response = await GET();
            const data = await response.json();

            data.models.forEach((model: any) => {
                expect(model).toHaveProperty('id');
                expect(model).toHaveProperty('type');
                expect(model).toHaveProperty('name');
                expect(model).toHaveProperty('version');
                expect(model).toHaveProperty('size');
                expect(model).toHaveProperty('url');
                expect(model).toHaveProperty('description');
            });
        });

        it('should have valid URLs for all models', async () => {
            const response = await GET();
            const data = await response.json();

            data.models.forEach((model: any) => {
                expect(model.url).toMatch(/^\/api\/proxy-model\?url=/);
            });
        });

        it('should set proper cache control headers', async () => {
            await GET();

            expect(NextResponse.json).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
                    }),
                })
            );
        });

        it('should return status as stable', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.status).toBe('stable');
        });

        it('should include ISO timestamp', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('should match exported AVAILABLE_MODELS constant', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.models).toEqual(AVAILABLE_MODELS);
        });
    });
});
