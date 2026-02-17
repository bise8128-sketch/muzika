/**
 * Tests for audio processor utilities
 */

import { segmentAudio, normalizeAudio, mergeSegments, SimpleAudioBuffer } from '../audioProcessor';

describe('audioProcessor', () => {
    describe('segmentAudio', () => {
        const mockAudioBuffer: SimpleAudioBuffer = {
            sampleRate: 44100,
            numberOfChannels: 2,
            length: 44100 * 10, // 10 seconds
            duration: 10,
            getChannelData: jest.fn().mockReturnValue(new Float32Array(44100 * 10).fill(0.1)),
        };

        it('should segment audio into correct number of chunks', () => {
            const segments = segmentAudio(mockAudioBuffer, 4); // 4s segments
            // 10 / 4 = 2.5 -> 3 segments
            expect(segments.length).toBe(3);
            expect(segments[0].startTime).toBe(0);
            expect(segments[1].startTime).toBe(4);
            expect(segments[2].startTime).toBe(8);
        });

        it('should include overlap in segments', () => {
            const segments = segmentAudio(mockAudioBuffer, 5);
            const sampleRate = 44100;
            const overlapSamples = 1.0 * sampleRate; // CROSSFADE_DURATION is 1.0
            const channels = 2;

            // Segment 0: 0 to 5s + overlap = 6.0s. Since it is interleaved stereo, length is doubled.
            expect(segments[0].data.length).toBe((5 * sampleRate + overlapSamples) * channels);
        });
    });

    describe('mergeSegments', () => {
        it('should merge segments correctly', () => {
            const sampleRate = 44100;
            const channels = 2;
            const crossfadeFrames = 1.0 * sampleRate; 
            const crossfadeSamples = crossfadeFrames * channels;
            
            // 2 seconds of stereo data each
            const segment1 = new Float32Array(2 * sampleRate * channels).fill(0.5);
            const segment2 = new Float32Array(2 * sampleRate * channels).fill(1.0);

            const merged = mergeSegments([segment1, segment2], sampleRate, channels);

            // 2s + 2s - 1s overlap = 3s total
            const expectedLength = 3 * sampleRate * channels;
            expect(merged.length).toBe(expectedLength);

            // Verify first part is 0.5
            expect(merged[0]).toBeCloseTo(0.5);
            // Verify end part is 1.0
            expect(merged[merged.length - 1]).toBeCloseTo(1.0);
            // Verify crossfade region (middle of crossfade should be average)
            const midCrossfade = segment1.length - crossfadeSamples / 2;
            expect(merged[Math.floor(midCrossfade)]).toBeCloseTo(0.75);
        });

        it('should throw error for empty segments', () => {
            expect(() => mergeSegments([], 44100)).toThrow('Cannot merge empty segments array');
        });
    });

    describe('normalizeAudio', () => {
        it('should normalize audio data', () => {
            const input = new Float32Array([0.5, 1.0, -0.5, -1.0]);
            const normalized = normalizeAudio(input);

            // Check that max absolute value is 1.0
            const maxAbs = Math.max(...Array.from(normalized).map(Math.abs));
            expect(maxAbs).toBeCloseTo(1.0);
        });

        it('should handle zero input', () => {
            const input = new Float32Array([0, 0, 0, 0]);
            const normalized = normalizeAudio(input);

            expect(normalized).toEqual(input);
        });

        it('should preserve relative amplitudes', () => {
            const input = new Float32Array([0.5, 0.25, -0.25, -0.5]);
            const normalized = normalizeAudio(input);

            // Ratios should be preserved
            expect(normalized[0] / normalized[1]).toBeCloseTo(2.0);
            expect(normalized[2] / normalized[3]).toBeCloseTo(0.5);
        });
    });
});
