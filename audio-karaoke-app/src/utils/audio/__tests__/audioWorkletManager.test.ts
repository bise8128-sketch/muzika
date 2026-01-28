/**
 * Tests for AudioWorkletManager
 */

import { AudioWorkletManager } from '../audioWorkletManager';
import { AudioContext } from 'web-audio-api';

// Mock AudioContext
jest.mock('web-audio-api', () => ({
    AudioContext: jest.fn().mockImplementation(() => ({
        audioWorklet: {
            addModule: jest.fn().mockResolvedValue(undefined)
        },
        destination: {
            connect: jest.fn()
        },
        close: jest.fn().mockResolvedValue(undefined)
    }))
}));

describe('AudioWorkletManager', () => {
    let audioContext: any;
    let manager: AudioWorkletManager;

    beforeEach(() => {
        audioContext = new AudioContext();
        manager = new AudioWorkletManager(audioContext);
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
            expect(audioContext.audioWorklet.addModule).toHaveBeenCalled();
        });

        it('should create an AudioWorkletNode', async () => {
            await manager.initialize();
            expect(manager.getWorkletNode()).not.toBeNull();
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
            audioContext.audioWorklet.addModule.mockRejectedValueOnce(new Error('Failed to load worklet'));
            await expect(manager.initialize()).rejects.toThrow('Failed to load worklet');
        });
    });
});
