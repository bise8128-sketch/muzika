/**
 * Tests for /api/status endpoint
 */

// Mock next/server before importing
jest.mock('next/server', () => ({
    NextResponse: {
        json: jest.fn((data: any, options?: any) => ({
            json: async () => data,
            status: options?.status || 200,
        })),
    },
}));

import { GET } from '../status/route';

describe('/api/status', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 200 status', async () => {
            const response = await GET();
            expect(response).toBeDefined();
            expect(response.status).toBe(200);
        });

        it('should return correct response structure', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data).toHaveProperty('status');
            expect(data).toHaveProperty('uptime');
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('environment');
            expect(data).toHaveProperty('nodeVersion');
            expect(data).toHaveProperty('memoryUsage');
            expect(data).toHaveProperty('services');
            expect(data).toHaveProperty('version');
        });

        it('should return status as ok', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.status).toBe('ok');
        });

        it('should return valid uptime in seconds', async () => {
            const response = await GET();
            const data = await response.json();

            expect(typeof data.uptime).toBe('number');
            expect(data.uptime).toBeGreaterThanOrEqual(0);
        });

        it('should return ISO timestamp', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

            // Verify it's a recent timestamp (within last 5 seconds)
            const timestamp = new Date(data.timestamp);
            const now = new Date();
            const diff = now.getTime() - timestamp.getTime();
            expect(diff).toBeLessThan(5000);
        });

        it('should return current environment', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.environment).toBe(process.env.NODE_ENV);
        });

        it('should return node version', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.nodeVersion).toBe(process.version);
            expect(data.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
        });

        it('should return memory usage information', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.memoryUsage).toHaveProperty('rss');
            expect(data.memoryUsage).toHaveProperty('heapTotal');
            expect(data.memoryUsage).toHaveProperty('heapUsed');
            expect(data.memoryUsage).toHaveProperty('external');

            // Verify values are positive numbers
            expect(data.memoryUsage.rss).toBeGreaterThan(0);
            expect(data.memoryUsage.heapTotal).toBeGreaterThan(0);
            expect(data.memoryUsage.heapUsed).toBeGreaterThan(0);
        });

        it('should return services information', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.services).toHaveProperty('modelRepository');
            expect(data.services.modelRepository).toBe('connected');
        });

        it('should return version', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.version).toBe('0.1.0');
        });

        it('should have increasing uptime over multiple calls', async () => {
            const response1 = await GET();
            const data1 = await response1.json();

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 100));

            const response2 = await GET();
            const data2 = await response2.json();

            expect(data2.uptime).toBeGreaterThanOrEqual(data1.uptime);
        });

        it('should return consistent data shape across multiple calls', async () => {
            const response1 = await GET();
            const data1 = await response1.json();

            const response2 = await GET();
            const data2 = await response2.json();

            expect(Object.keys(data1).sort()).toEqual(Object.keys(data2).sort());
        });
    });
});
