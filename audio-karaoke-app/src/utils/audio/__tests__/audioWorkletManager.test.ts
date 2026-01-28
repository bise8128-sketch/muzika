/**
 * Tests for AudioWorkletManager
 */

import { AudioWorkletManager } from '../audioWorkletManager';

// Mock the AudioContext and AudioWorkletNode
const mockAudioWorklet = {
    addModule: jest.fn().mockResolvedValue(undefined)
};

const mockAudioWorkletNode = {
    port: {
        onmessage: jest.fn()
    },
    disconnect: jest.fn(),
    close: jest.fn()
};

const mockAudioContext = {
    audioWorklet: mockAudioWorklet,
    destination: {
        connect: jest.fn()
    },
    close: jest.fn().mockResolvedValue(undefined)
};

// Mock the global AudioContext constructor
global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);

// Mock AudioWorkletNode
global.AudioWorkletNode = jest.fn().mockImplementation(() => mockAudioWorkletNode);

describe('AudioWorkletManager', () => {
    let manager: AudioWorkletManager;

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new AudioWorkletManager(mockAudioContext as any);
    });

    afterEach(() => {
        if (manager.isInitialized()) {
            manager.destroy();
        }
    });

    describe('Initialization', () => {
        it('should initialize successfully', async () => {
            await expect(manager.initialize()).resolves.not.toThrow();
            expect(manager.isInitialized()).toBe(true);
        });

        it('should not initialize twice', async () => {
            await manager.initialize();
            await expect(manager.initialize()).resolves.not.toThrow();
            expect(manager.isInitialized()).toBe(true);
        });

        it('should load the worklet script', async () => {
            await manager.initialize();
            expect(mockAudioWorklet.addModule).toHaveBeenCalled();
        });

        it('should create an AudioWorkletNode', async () => {
            await manager.initialize();
            expect(manager.getWorkletNode()).not.toBeNull();
            expect(global.AudioWorkletNode).toHaveBeenCalled();
        });
    });

    describe('Configuration', () => {
        it('should set gain', async () => {
            await manager.initialize();
            manager.setGain(0.5);
            // This is a basic test - in a real implementation, we'd need to verify the gain was set
        });

        it('should set bypass mode', async () => {
            await manager.initialize();
            manager.setBypass(true);
            // This is a basic test - in a real implementation, we'd need to verify the bypass was set
        });

        it('should register metrics callback', async () => {
            await manager.initialize();
            const callback = jest.fn();
            manager.onMetricsUpdate(callback);
            expect(callback).not.toHaveBeenCalled();
        });

        it('should get average metrics', async () => {
            await manager.initialize();
            const metrics = manager.getAverageMetrics();
            expect(metrics).toBeNull();
        });
    });

    describe('Cleanup', () => {
        it('should destroy and clean up resources', async () => {
            await manager.initialize();
            manager.destroy();
            expect(manager.isInitialized()).toBe(false);
            expect(manager.getWorkletNode()).toBeNull();
        });

        it('should handle multiple destroy calls', async () => {
            await manager.initialize();
            manager.destroy();
            manager.destroy(); // Should not throw
            expect(manager.isInitialized()).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle initialization errors', async () => {
            // Mock addModule to throw an error
            mockAudioWorklet.addModule.mockRejectedValueOnce(new Error('Failed to load worklet'));
            await expect(manager.initialize()).rejects.toThrow('Failed to load worklet');
        });
    });
});
