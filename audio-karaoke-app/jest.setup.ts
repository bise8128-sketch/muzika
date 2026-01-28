/**
 * Jest setup file
 */
import '@testing-library/jest-dom';

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
    createBuffer = jest.fn().mockReturnValue({
        duration: 10,
        sampleRate: 44100,
        numberOfChannels: 1,
        length: 441000,
        getChannelData: jest.fn().mockReturnValue(new Float32Array(441000)),
    });
    destination = {};
}

(window as any).AudioContext = AudioContextMock;
(window as any).webkitAudioContext = AudioContextMock;
