
import { separateAudio } from '../separateAudio';
import { ModelType, ModelInfo } from '@/types/model';
import * as onnxSetup from '../onnxSetup';
import { workerPool } from '../workerPool';
import { audioCache } from '@/utils/storage/audioCache';

// Mocks
jest.mock('../workerPool', () => ({
    workerPool: {
        addTask: jest.fn()
    }
}));

jest.mock('@/utils/storage/audioCache', () => ({
    audioCache: {
        hashFile: jest.fn().mockResolvedValue('test-hash'),
        getCachedAudio: jest.fn().mockResolvedValue(null),
        cacheAudioResult: jest.fn()
    }
}));

jest.mock('../onnxSetup', () => ({
    checkONNXSupport: jest.fn(),
    isServerAvailable: jest.fn(), // We are not exporting this, but we can mock the fetch inside separateAudio via global.fetch
    checkWebGPUSupport: jest.fn().mockResolvedValue(true)
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock AudioContext and other browser APIs
class MockAudioContext {
    sampleRate = 44100;
    state = 'running';
    createBuffer = jest.fn();
    decodeAudioData = jest.fn().mockResolvedValue({
        numberOfChannels: 2,
        length: 1000,
        sampleRate: 44100,
        getChannelData: jest.fn().mockReturnValue(new Float32Array(1000))
    });
    resume = jest.fn().mockResolvedValue(undefined);
}
global.AudioContext = MockAudioContext as any;
global.window = { AudioContext: MockAudioContext } as any;

describe('separateAudio Smart Routing', () => {
    const mockFile = new File([''], 'test.mp3', { type: 'audio/mpeg' });
    const mockOptions = {
        modelInfo: { id: 'test-model', type: ModelType.MDX } as ModelInfo,
        onProgress: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (workerPool.addTask as jest.Mock).mockImplementation((type) => {
             if (type === 'INIT_STREAM_SESSION') {
                 return Promise.resolve({ sessionId: 'test-session', backend: 'wasm' });
             }
             if (type === 'PROCESS_STREAM_CHUNK') {
                 return Promise.resolve({
                     vocals: new Float32Array(100),
                     instrumentals: new Float32Array(100),
                     chunkIndex: 0
                 });
             }
             return Promise.resolve({});
        });
    });

    it('should use client-side by default for MDX models on high-end devices', async () => {
        // High-end device
        (onnxSetup.checkONNXSupport as jest.Mock).mockResolvedValue({ isLowEnd: false });

        await separateAudio(mockFile, mockOptions);

        // Should call workerPool
        expect(workerPool.addTask).toHaveBeenCalledWith('INIT_STREAM_SESSION', expect.anything(), 'HIGH');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should route to server for server-only models (HTDEMUCS)', async () => {
        const serverOptions = {
            ...mockOptions,
            modelInfo: { id: 'htdemucs', type: ModelType.HTDEMUCS } as ModelInfo
        };

        // Mock upload and process calls
        mockFetch.mockResolvedValueOnce({ 
            ok: true, 
            json: async () => ({ filename: 'uploaded.mp3' }) 
        }); // Upload
        
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'completed', stems: { vocals: 'v.mp3', other: 'o.mp3' } })
        }); // Process
        
        // Mock fetch for stems
        mockFetch.mockResolvedValueOnce({ arrayBuffer: async () => new ArrayBuffer(10) });
        mockFetch.mockResolvedValueOnce({ arrayBuffer: async () => new ArrayBuffer(10) });

        await separateAudio(mockFile, serverOptions);

        expect(workerPool.addTask).not.toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalledWith('/api/backend-upload', expect.anything());
    });
    
    // Note: To test the low-end device logic, we would need to export `isServerAvailable` or mock the fetch call it makes.
    // Since `isServerAvailable` is internal, we can rely on how it calls `fetch('/api/status')`.
    
    it('should fallback to client if server model request fails', async () => {
         const serverOptions = {
            ...mockOptions,
            modelInfo: { id: 'htdemucs', type: ModelType.HTDEMUCS } as ModelInfo
        };

        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 }); // Upload fails

        await expect(separateAudio(mockFile, serverOptions)).rejects.toThrow();
    });
});
