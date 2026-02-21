import { separateAudio } from '../separateAudio';
import { ModelType } from '@/types/model';
import { audioCache } from '@/utils/storage/audioCache';
import { MockWorker } from '../../../__mocks__/workerMock';
import { MockAudioContext } from '../../../__mocks__/audioContextMock';
import * as onnxSetup from '../onnxSetup';

// Mocks
jest.mock('@/utils/storage/audioCache');
jest.mock('@/utils/audio/audioContext', () => ({
    getAudioContext: jest.fn(() => new MockAudioContext()),
}));

// The SessionWorker inside separateAudio.ts uses the global Worker instance.
// We will mock global.Worker directly in beforeEach.

jest.mock('@/utils/audio/BrowserAudioSegmenter', () => {
    return {
        BrowserAudioSegmenter: jest.fn().mockImplementation(() => ({
            segmentFile: jest.fn().mockImplementation(async function* () {
                yield {
                    data: new Float32Array(100),
                    startTime: 0,
                    sampleRate: 44100,
                    channelCount: 2,
                    duration: 1
                };
            }),
            dispose: jest.fn(),
            totalDuration: 10
        }))
    };
});

jest.mock('@/utils/audio/StreamableBufferManager', () => {
    return {
        StreamableBufferManager: jest.fn().mockImplementation(() => ({
            addChunk: jest.fn(),
            play: jest.fn(),
            getAllAudioBuffers: jest.fn().mockReturnValue({
                vocals: { length: 100, numberOfChannels: 2, getChannelData: () => new Float32Array(100) },
                instrumentals: { length: 100, numberOfChannels: 2, getChannelData: () => new Float32Array(100) }
            }),
            acquireAudioBuffer: jest.fn()
        }))
    };
});

// Mock checkONNXSupport
jest.mock('../onnxSetup', () => ({
    ...jest.requireActual('../onnxSetup'),
    checkONNXSupport: jest.fn()
}));

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
        class LocalMockWorker {
            onmessage: any;
            onerror: any;
            postMessage(msg: { type: string; payload: any }) {
                setTimeout(() => {
                    if (this.onmessage) {
                        if (msg.type === 'INIT_STREAM_SESSION') {
                            this.onmessage({ data: { type: 'SUCCESS', payload: { sessionId: msg.payload.sessionId, backend: 'wasm' } } } as any);
                        } else if (msg.type === 'PROCESS_STREAM_CHUNK') {
                            this.onmessage({ data: { type: 'SUCCESS', payload: { vocals: new Float32Array(100), instrumentals: new Float32Array(100), chunkIndex: msg.payload.chunkIndex, backend: 'wasm' } } } as any);
                        } else if (msg.type === 'END_STREAM_SESSION') {
                            this.onmessage({ data: { type: 'SUCCESS', payload: {} } } as any);
                        }
                    }
                }, 0);
            }
            terminate() {}
            addEventListener(type: string, listener: any) {
                if (type === 'message') this.onmessage = listener;
                if (type === 'error') this.onerror = listener;
            }
        }
        (global as any).Worker = LocalMockWorker;
        (audioCache.hashFile as jest.Mock).mockResolvedValue('test-hash');
        
        // Default ONNX support (high-end)
        (onnxSetup.checkONNXSupport as jest.Mock).mockResolvedValue({
            isLowEnd: false,
            webgpu: true,
            wasm: true,
            threads: 4,
            simd: true,
            platform: 'linux'
        });

        // Mock fetch
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should check cache before processing', async () => {
        (audioCache.getCachedAudio as jest.Mock).mockResolvedValue({
            vocals: new ArrayBuffer(16),
            instrumentals: new ArrayBuffer(16),
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

    describe('Smart Routing', () => {
        beforeEach(() => {
            (audioCache.getCachedAudio as jest.Mock).mockResolvedValue(null);
        });

        it('should use client-side default processing for high-end devices', async () => {
             // Setup: High-end device (already set in beforeEach), standard model
             // Expect: No server status check, normal client processing
             
             await separateAudio(mockFile, { modelInfo: mockModelInfo });
             
             expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should route to server for server-only models', async () => {
            const serverModel = { ...mockModelInfo, type: ModelType.HTDEMUCS };
            
            // Mock server flow
            const mockFetch = global.fetch as jest.Mock;
            
            // 1. Upload
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ filename: 'server-file.mp3' })
            });
            
            // 2. Process
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ 
                    status: 'completed',
                    stems: {
                        vocals: 'http://server/vocals.mp3',
                        instrumental: 'http://server/instrumental.mp3'
                    }
                })
            });

            // 3. Download stems (2 calls)
            mockFetch.mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(100)
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(100)
            });

            const result = await separateAudio(mockFile, { modelInfo: serverModel });
            
            expect(mockFetch).toHaveBeenCalledWith('/api/backend-upload', expect.any(Object));
            expect(mockFetch).toHaveBeenCalledWith('/api/python-processing', expect.any(Object));
            expect(result.executionBackend).toBe('server');
        });

        it('should offload to server for low-end devices if available', async () => {
            // Setup: Low-end device
            (onnxSetup.checkONNXSupport as jest.Mock).mockResolvedValue({
                isLowEnd: true,
                webgpu: false,
                wasm: true,
                threads: 2,
                simd: true,
                platform: 'mobile'
            });

            const mockFetch = global.fetch as jest.Mock;
            
            // 1. Status check
            mockFetch.mockResolvedValueOnce({ ok: true }); // Server available
            
            // 2. Upload
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ filename: 'server-file.mp3' })
            });
             
            // 3. Process
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ 
                    status: 'completed',
                    stems: {
                        vocals: 'http://server/vocals.mp3',
                        instrumental: 'http://server/instrumental.mp3'
                    }
                })
            });

            // 4. Download stems (2 calls)
            mockFetch.mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(10) });
            mockFetch.mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(10) });

            const result = await separateAudio(mockFile, { modelInfo: mockModelInfo });
            
            expect(mockFetch).toHaveBeenCalledWith('/api/status', expect.any(Object));
            expect(result.executionBackend).toBe('server');
        });

        it('should fallback to client-side if server request fails', async () => {
             // Setup: Low-end device
            (onnxSetup.checkONNXSupport as jest.Mock).mockResolvedValue({
                isLowEnd: true,
                webgpu: false,
                wasm: true,
                threads: 2,
                simd: true,
                platform: 'mobile'
            });

            const mockFetch = global.fetch as jest.Mock;
            
            // 1. Status check (Available)
            mockFetch.mockResolvedValueOnce({ ok: true });
            
            // 2. Upload (Fails!)
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Upload failed' })
            });
            
            const onProgress = jest.fn();
            const result = await separateAudio(mockFile, { modelInfo: mockModelInfo, onProgress });
            
            // Should fallback to client
            expect(mockFetch).toHaveBeenCalledWith('/api/backend-upload', expect.any(Object));
            expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Server unavailable')
            }));
            
            expect(result.vocals).toBeDefined();
        });
    });
});
