import { separateAudio } from '../separateAudio';
import { ModelType } from '@/types/model';
import { audioCache } from '@/utils/storage/audioCache';
import { MockWorker } from '../../../__mocks__/workerMock';
import { MockAudioContext } from '../../../__mocks__/audioContextMock';

// Mocks
jest.mock('@/utils/storage/audioCache');
jest.mock('@/utils/audio/audioContext', () => ({
    getAudioContext: jest.fn(() => new MockAudioContext()),
}));

// Mock WorkerPool
jest.mock('@/utils/worker/WorkerPool', () => {
    return {
        WorkerPool: jest.fn().mockImplementation(() => ({
            addTask: jest.fn().mockResolvedValue({
                vocals: new Float32Array(100),
                instrumentals: new Float32Array(100),
                chunkIndex: 0,
                backend: 'wasm'
            }),
            terminate: jest.fn()
        }))
    };
});

describe('separateAudio', () => {
    const mockFile = new File(['dummy content'], 'test.mp3', { type: 'audio/mpeg' });
    const mockModelInfo = {
        id: 'test-model',
        type: ModelType.MDX23,
        name: 'Test Model',
        version: '1.0',
        size: 1000,
        url: 'test.onnx',
        isDefault: true
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (global as any).Worker = MockWorker;
        (audioCache.hashFile as jest.Mock).mockResolvedValue('test-hash');
    });

    it('should check cache before processing', async () => {
        (audioCache.getCachedAudio as jest.Mock).mockResolvedValue({
            vocals: new ArrayBuffer(10),
            instrumentals: new ArrayBuffer(10),
            processedAt: Date.now()
        });

        const result = await separateAudio(mockFile, { modelInfo: mockModelInfo });

        expect(audioCache.getCachedAudio).toHaveBeenCalledWith('test-hash', 'test-model');
        expect(result.fileHash).toBe('test-hash');
    });

    it('should process if cache miss', async () => {
        (audioCache.getCachedAudio as jest.Mock).mockResolvedValue(null);

        const onProgress = jest.fn();
        const result = await separateAudio(mockFile, { 
            modelInfo: mockModelInfo,
            onProgress
        });

        expect(result.vocals).toBeDefined();
        expect(result.instrumentals).toBeDefined();
    });
});
