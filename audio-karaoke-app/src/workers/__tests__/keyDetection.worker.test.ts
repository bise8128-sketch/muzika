/**
 * Test for the Key Detection Worker.
 * 
 * Since Jest runs in jsdom (not a real Worker environment), we mock the Worker scope
 * and test the `onmessage` handler directly.
 */

describe('keyDetection.worker', () => {
    let workerHandler: (e: MessageEvent) => void;
    let postMessageSpy: jest.Mock;
    let consoleErrorSpy: jest.Mock;
    let mockAnalyzeKeyFromPCM: jest.Mock;

    beforeEach(() => {
        // Reset mocks
        jest.resetModules(); // Important to clear the require cache
        jest.clearAllMocks();
        
        postMessageSpy = jest.fn();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockAnalyzeKeyFromPCM = jest.fn();

        // Mock global scope BEFORE requiring the worker
        (global as any).self = {
            postMessage: postMessageSpy,
            onmessage: null,
            onerror: null,
        };

        // Mock the dependency using doMock to affect the next require
        jest.doMock('../../utils/audio/keyDetectionCore', () => ({
            analyzeKeyFromPCM: mockAnalyzeKeyFromPCM,
        }));

        // Load the worker code
        // We use isolateModules to ensure it executes top-level code (setting onmessage)
        jest.isolateModules(() => {
            require('../keyDetection.worker');
        });

        workerHandler = (global as any).self.onmessage;
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('should handle ANALYZE_KEY and return KEY_RESULT', () => {
        const mockKeyInfo = { tonic: 'C', scale: 'major', confidence: 0.9 };
        mockAnalyzeKeyFromPCM.mockReturnValue(mockKeyInfo);

        const payload = {
            channelData: new Float32Array(100),
            sampleRate: 44100
        };

        workerHandler({
            data: { type: 'ANALYZE_KEY', payload }
        } as MessageEvent);

        expect(mockAnalyzeKeyFromPCM).toHaveBeenCalledWith(payload.channelData, 44100);
        expect(postMessageSpy).toHaveBeenCalledWith({
            type: 'KEY_RESULT',
            payload: mockKeyInfo
        });
    });

    it('should return ERROR if channelData is missing/invalid', () => {
        workerHandler({
            data: { 
                type: 'ANALYZE_KEY', 
                payload: { channelData: [], sampleRate: 44100 } // Not a Float32Array
            }
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ERROR',
            payload: expect.objectContaining({ message: expect.stringContaining('requires a non-empty Float32Array') })
        }));
    });

    it('should return ERROR if sampleRate is invalid', () => {
        workerHandler({
            data: { 
                type: 'ANALYZE_KEY', 
                payload: { channelData: new Float32Array(10), sampleRate: 0 } 
            }
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ERROR',
            payload: expect.objectContaining({ message: expect.stringContaining('requires a positive sampleRate') })
        }));
    });

    it('should catch synchronous errors from the core logic', () => {
        mockAnalyzeKeyFromPCM.mockImplementation(() => {
            throw new Error('Core logic failed');
        });

        workerHandler({
            data: { 
                type: 'ANALYZE_KEY', 
                payload: { channelData: new Float32Array(100), sampleRate: 44100 } 
            }
        } as MessageEvent);

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(postMessageSpy).toHaveBeenCalledWith({
            type: 'ERROR',
            payload: { message: 'Core logic failed' }
        });
    });
});
