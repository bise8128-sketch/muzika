/**
 * Tests for audio processor utilities
 */

import { segmentAudio, normalizeAudio } from '../audioProcessor';

describe('audioProcessor', () => {
    describe('segmentAudio', () => {
        it('should exist as a function', () => {
            expect(typeof segmentAudio).toBe('function');
        });

        // Note: Full testing requires mocked AudioBuffer objects
        // These are placeholder tests
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
