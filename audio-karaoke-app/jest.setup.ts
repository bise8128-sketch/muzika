/**
 * Jest setup file
 */
import '@testing-library/jest-dom';
import crypto from 'crypto';

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => crypto.randomUUID(),
    getRandomValues: (arr) => crypto.webcrypto.getRandomValues(arr)
  }
});

// Polyfill for Blob.arrayBuffer() (missing in JSDOM)
if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function () {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.readAsArrayBuffer(this);
        });
    };
}

// Mock for AudioContext
class AudioContextMock {
    state = 'suspended';
    resume = jest.fn().mockResolvedValue(undefined);
    suspend = jest.fn().mockResolvedValue(undefined);
    close = jest.fn().mockResolvedValue(undefined);
    createGain = jest.fn().mockReturnValue({
        gain: { value: 1 },
        connect: jest.fn(),
    });
    decodeAudioData = jest.fn().mockImplementation((buffer) => {
        if (buffer.byteLength === 0) {
            return Promise.reject(new Error('Failed to decode'));
        }
        return Promise.resolve({
            duration: 10,
            sampleRate: 44100,
            numberOfChannels: 2,
            length: 441000,
            getChannelData: jest.fn().mockReturnValue(new Float32Array(441000)),
        });
    });
    createBuffer = jest.fn((numberOfChannels, length, sampleRate) => {
        const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
        return {
            length,
            duration: length / sampleRate,
            sampleRate,
            numberOfChannels,
            getChannelData: jest.fn((channel) => {
                if (channel >= numberOfChannels) throw new Error('Channel index out of bounds');
                return channels[channel];
            }),
            copyToChannel: jest.fn((source, channelNumber, startInChannel = 0) => {
                if (channelNumber >= numberOfChannels) throw new Error('Channel index out of bounds');
                channels[channelNumber].set(source, startInChannel);
            }),
        };
    });
    destination = {};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).AudioContext = AudioContextMock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).webkitAudioContext = AudioContextMock;

// Clean up IndexedDB after each test to prevent state leakage
afterEach(async () => {
    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
        try {
            const databases = await indexedDB.databases();
            await Promise.all(
                databases.map((db) => {
                    if (db.name) {
                        return new Promise<void>((resolve, reject) => {
                            const request = indexedDB.deleteDatabase(db.name!);
                            request.onsuccess = () => resolve();
                            request.onerror = () => reject(request.error);
                            request.onblocked = () => resolve();
                        });
                    }
                    return Promise.resolve();
                })
            );
        } catch (error) {
            console.error('Failed to clear IndexedDB:', error);
        }
    }
});

