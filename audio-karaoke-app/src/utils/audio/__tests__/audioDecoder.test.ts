/**
 * Tests for audio decoder utilities
 */

import { decodeAudioFile, audioBufferToFloat32Array, SUPPORTED_FORMATS } from '../audioDecoder';

describe('audioDecoder', () => {
    describe('SUPPORTED_FORMATS', () => {
        it('should include common audio formats', () => {
            expect(SUPPORTED_FORMATS).toContain('audio/mpeg');
            expect(SUPPORTED_FORMATS).toContain('audio/wav');
            expect(SUPPORTED_FORMATS).toContain('audio/ogg');
        });
    });

    describe('decodeAudioFile', () => {
        it('should reject unsupported file types', async () => {
            const file = new File([], 'test.txt', { type: 'text/plain' });

            await expect(decodeAudioFile(file)).rejects.toThrow('Unsupported audio format');
        });

        it('should accept supported file extensions even with unknown MIME type', async () => {
            // This test would need a real audio file to work properly
            // For now, we just test the validation logic
            const file = new File([], 'test.mp3', { type: 'application/octet-stream' });

            // Will fail at decode stage, but shouldn't fail at validation
            await expect(decodeAudioFile(file)).rejects.toThrow('Failed to decode');
        });
    });

    describe('audioBufferToFloat32Array', () => {
        // These tests would need mocked AudioBuffer objects
        // or real audio data to test properly

        it('should exist as a function', () => {
            expect(typeof audioBufferToFloat32Array).toBe('function');
        });
    });
});
