import { getRecommendedShift, VocalRangeType } from '../vocalRange';
import { KeyInfo } from '../keyDetectionCore';

describe('VocalRange', () => {
    // Helper to create a mock KeyInfo
    const createKey = (tonic: string, scale: 'major' | 'minor' = 'major'): KeyInfo => ({
        tonic,
        scale,
        confidence: 1.0
    });

    describe('getRecommendedShift', () => {
        it('should suggest 0 shift for Tenor if track is in C Major', () => {
            const shift = getRecommendedShift(createKey('C'), 'tenor');
            expect(shift).toBe(0); 
        });

        it('should suggest -2 shift for Tenor if track is in D Major', () => {
            // Tenor center: 60 (C4)
            // Track C center: 60 (C4)
            // Track D center: 62 (D4)
            // Shift: 60 - 62 = -2
            const shift = getRecommendedShift(createKey('D'), 'tenor');
            expect(shift).toBe(-2); 
        });

        it('should suggest +2 shift for Tenor if track is in Bb (A#) Major', () => {
            // Tenor center: 60 (C4)
            // A# is index 10. Center = 60 + 10 = 70.
            // Shift: 60 - 70 = -10.
            // Normalize: -10 + 12 = +2.
            const shift = getRecommendedShift(createKey('A#'), 'tenor');
            expect(shift).toBe(2); 
        });

        it('should suggest 0 shift for Soprano in C Major (octave adjusted)', () => {
            // Soprano center: 72 (C5)
            // Track C center: 60 (C4)
            // Shift: 72 - 60 = 12.
            // Normalize: 12 - 12 = 0.
            const shift = getRecommendedShift(createKey('C'), 'soprano');
            expect(shift).toBe(0);
        });

        it('should suggest correct shift for Bass in G Major', () => {
            // Bass center: 53 (F3)
            // G is index 7. Center = 60 + 7 = 67.
            // Shift: 53 - 67 = -14.
            // Normalize: -14 + 12 = -2.
            // Normalize again: -2.
            // Wait:
            // -14 + 12 = -2.
            // -2 is within [-6, 6].
            const shift = getRecommendedShift(createKey('G'), 'bass');
            expect(shift).toBe(-2);
        });

        it('should handle minor keys using the same tonic logic', () => {
            // Current implementation ignores scale type and just uses tonic
            const shiftMajor = getRecommendedShift(createKey('A', 'major'), 'alto');
            const shiftMinor = getRecommendedShift(createKey('A', 'minor'), 'alto');
            expect(shiftMajor).toBe(shiftMinor);
        });

        it('should return 0 if tonic is invalid', () => {
            const shift = getRecommendedShift(createKey('InvalidTonic'), 'tenor');
            expect(shift).toBe(0);
        });

        it('should normalize large positive shifts', () => {
            // Test case that would result in > 6 shift without normalization
            // Vocal Range: Tenor (Center 60)
            // Key: F# (Index 6, Center 66)
            // Shift: 60 - 66 = -6. Correct.
            
            // Let's try Alto (Center 65 - F4) and Key C (Center 60 - C4)
            // Shift: 65 - 60 = 5. Correct.
            
            // Alto (65) and Key G (67) -> 65 - 67 = -2.

            // Let's try Soprano (Center 72 - C5) and Key F# (66)
            // Shift: 72 - 66 = 6.

            // Let's try Soprano (72) and Key G (67)
            // Shift: 72 - 67 = 5.

            // Let's try Bass (Center 53 - F3) and Key C (60)
            // Shift: 53 - 60 = -7.
            // Normalize: -7 + 12 = 5.
            const shift = getRecommendedShift(createKey('C'), 'bass');
            expect(shift).toBe(5);
        });

        it('should suggest correct shift for Bass in F# Major', () => {
            // Bass center: 53 (F3)
            // F# is index 6. Center = 60 + 6 = 66.
            // Shift: 53 - 66 = -13.
            // Normalize: -13 + 12 = -1.
            const shift = getRecommendedShift(createKey('F#'), 'bass');
            expect(shift).toBe(-1);
        });
    });
});
