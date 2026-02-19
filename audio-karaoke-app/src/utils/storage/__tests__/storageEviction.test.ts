import { audioCache } from '../audioCache';
import { db } from '../audioDatabase';
import { StorageManager } from '../StorageManager';

// Mock Dexie database
jest.mock('../audioDatabase', () => ({
    db: {
        cachedAudio: {
            where: jest.fn().mockReturnThis(),
            equals: jest.fn().mockReturnThis(),
            first: jest.fn(),
            add: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            toArray: jest.fn(),
            orderBy: jest.fn().mockReturnThis(),
            clear: jest.fn(),
        },
        models: {
            where: jest.fn().mockReturnThis(),
            equals: jest.fn().mockReturnThis(),
            first: jest.fn(),
            add: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            toArray: jest.fn(),
            orderBy: jest.fn().mockReturnThis(),
            clear: jest.fn(),
        },
        transaction: jest.fn((mode, tables, cb) => cb()),
    },
}));

describe('Storage Management', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock browser globals
        global.navigator = {
            storage: {
                estimate: jest.fn().mockResolvedValue({ usage: 0, quota: 1000 }),
            },
        } as any;
    });

    describe('AudioCache Eviction', () => {
        it('should evict oldest entries when limit is exceeded', async () => {
            const mockEntries = [
                { id: 1, fileName: 'old.mp3', processedAt: 100, vocals: new ArrayBuffer(500 * 1024 * 1024), instrumentals: new ArrayBuffer(0) }, // 500MB
                { id: 2, fileName: 'middle.mp3', processedAt: 200, vocals: new ArrayBuffer(400 * 1024 * 1024), instrumentals: new ArrayBuffer(0) }, // 400MB
                { id: 3, fileName: 'new.mp3', processedAt: 300, vocals: new ArrayBuffer(200 * 1024 * 1024), instrumentals: new ArrayBuffer(0) }, // 200MB
            ];

            (db.cachedAudio.orderBy as jest.Mock).mockReturnThis();
            (db.cachedAudio.toArray as jest.Mock).mockResolvedValue(mockEntries);
            
            // Mock getCacheStats (internal call)
            jest.spyOn(audioCache, 'getCacheStats').mockResolvedValue({
                totalFiles: 3,
                totalSizeGB: 1.1, // 500 + 400 + 200 = 1100MB
                oldestFile: new Date(100),
                newestFile: new Date(300),
                files: []
            });

            await audioCache.evictOldestIfNeeded(1.0); // 1GB limit

            // Should delete oldest (id: 1)
            expect(db.cachedAudio.delete).toHaveBeenCalledWith(1);
            // It might delete id: 2 as well to reach 70% (700MB)
            // 1100 - 500 = 600MB. 600MB < 700MB, so it should stop after deleting id: 1.
            expect(db.cachedAudio.delete).not.toHaveBeenCalledWith(2);
        });
    });

    describe('StorageManager.runWithRetry', () => {
        it('should retry operation after cleanup on QuotaExceededError', async () => {
            const mockOp = jest.fn()
                .mockRejectedValueOnce(new Error('QuotaExceededError'))
                .mockResolvedValueOnce('success');

            const emergencyCleanupSpy = jest.spyOn(StorageManager, 'emergencyCleanup').mockResolvedValue();

            const result = await StorageManager.runWithRetry(mockOp, 'TestOp');

            expect(result).toBe('success');
            expect(emergencyCleanupSpy).toHaveBeenCalled();
            expect(mockOp).toHaveBeenCalledTimes(2);
        });

        it('should throw if non-quota error occurs', async () => {
            const mockOp = jest.fn().mockRejectedValue(new Error('Other error'));
            
            await expect(StorageManager.runWithRetry(mockOp)).rejects.toThrow('Other error');
            expect(mockOp).toHaveBeenCalledTimes(1);
        });
    });
});
