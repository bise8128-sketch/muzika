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

import { jest } from '@jest/globals';

// Mock next-intl
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
    useLocale: () => 'en',
    useMessages: () => ({}),
    useNow: () => new Date(),
    useTimeZone: () => 'UTC',
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('next-intl/routing', () => ({
    defineRouting: jest.fn((config) => config),
}));

jest.mock('next-intl/navigation', () => ({
    createNavigation: jest.fn(() => ({
        Link: ({ children }: { children: React.ReactNode }) => children,
        redirect: jest.fn(),
        usePathname: jest.fn(() => '/'),
        useRouter: jest.fn(() => ({
            push: jest.fn(),
            replace: jest.fn(),
            prefetch: jest.fn(),
        })),
    })),
}));

jest.mock('@xenova/transformers', () => ({
    pipeline: jest.fn().mockResolvedValue(() => Promise.resolve([{ text: 'mocked text', start: 0, end: 1 }])),
    env: {
        allowLocalModels: true,
        useBrowserCache: false,
    },
}));

jest.mock('@huggingface/hub', () => ({
    downloadFile: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
}));

// Polyfill for fetch (missing in Node < 18 or some Jest environments)
if (!global.fetch) {
    (global as any).fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
            text: () => Promise.resolve(''),
            blob: () => Promise.resolve(new Blob())
        })
    );
}

// Polyfill for Response and Headers if missing
if (!global.Response) {
    (global as any).Response = class {
        constructor(public body: any, public init: any) {}
        get ok() { return this.init?.status ? (this.init.status >= 200 && this.init.status < 300) : true; }
        json() { return Promise.resolve(JSON.parse(this.body)); }
    };
}

// Mock for AudioContext
class AudioContextMock {
    state = 'suspended';
    sampleRate = 44100;
    currentTime = 0;
    resume = jest.fn().mockResolvedValue(undefined);
    suspend = jest.fn().mockResolvedValue(undefined);
    close = jest.fn().mockResolvedValue(undefined);
    createGain = jest.fn().mockReturnValue({
        gain: { value: 1, setValueAtTime: jest.fn() },
        connect: jest.fn(),
        disconnect: jest.fn()
    });
    createBufferSource = jest.fn().mockReturnValue({
        buffer: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        onended: null,
        playbackRate: { value: 1, setValueAtTime: jest.fn() }
    });
    decodeAudioData = jest.fn().mockImplementation((buffer) => {
        if (!buffer || buffer.byteLength === 0) {
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

// Mock HTMLAudioElement.canPlayType
if (typeof HTMLAudioElement !== 'undefined') {
    HTMLAudioElement.prototype.canPlayType = jest.fn((mimeType: string) => {
        if (['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/mp4', 'audio/aac'].includes(mimeType)) {
            return 'probably';
        }
        return '';
    }) as any;
}

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

