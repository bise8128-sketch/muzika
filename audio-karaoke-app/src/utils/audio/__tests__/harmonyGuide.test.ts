/**
 * Tests for harmonyGuide utility functions
 */

import {
    getScaleNotes,
    getHarmonyIntervals,
    isHarmonyMatch,
} from '../harmonyGuide';

// ── getScaleNotes ───────────────────────────────────────────────

describe('getScaleNotes', () => {
    it('should return correct pitch classes for C major', () => {
        expect(getScaleNotes('C', 'major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
    });

    it('should return correct pitch classes for A minor', () => {
        // A=9, B=11, C=0, D=2, E=4, F=5, G=7
        expect(getScaleNotes('A', 'minor')).toEqual([9, 11, 0, 2, 4, 5, 7]);
    });

    it('should return correct pitch classes for G major', () => {
        // G=7, A=9, B=11, C=0, D=2, E=4, F#=6
        expect(getScaleNotes('G', 'major')).toEqual([7, 9, 11, 0, 2, 4, 6]);
    });

    it('should return correct pitch classes for D minor', () => {
        // D=2, E=4, F=5, G=7, A=9, Bb=10, C=0
        expect(getScaleNotes('D', 'minor')).toEqual([2, 4, 5, 7, 9, 10, 0]);
    });
});

// ── getHarmonyIntervals ─────────────────────────────────────────

describe('getHarmonyIntervals', () => {
    it('should compute diatonic 3rd and 5th for C4 in C major', () => {
        const suggestions = getHarmonyIntervals(60, 'C', 'major'); // C4 = MIDI 60
        
        // 3rd of C in C major = E (MIDI 64)
        const third = suggestions.find(s => s.interval === '3rd');
        expect(third).toBeDefined();
        expect(third!.midiNote).toBe(64); // E4
        expect(third!.semitonesFromRoot).toBe(4);

        // 5th of C in C major = G (MIDI 67)
        const fifth = suggestions.find(s => s.interval === '5th');
        expect(fifth).toBeDefined();
        expect(fifth!.midiNote).toBe(67); // G4
        expect(fifth!.semitonesFromRoot).toBe(7);
    });

    it('should compute diatonic 3rd and 5th for D4 in C major', () => {
        const suggestions = getHarmonyIntervals(62, 'C', 'major'); // D4 = MIDI 62

        // D→F is a minor 3rd (3 semitones) — diatonic in C major
        const third = suggestions.find(s => s.interval === '3rd');
        expect(third).toBeDefined();
        expect(third!.midiNote).toBe(65); // F4
        expect(third!.semitonesFromRoot).toBe(3);

        // D→A is a 5th (7 semitones) — diatonic in C major
        const fifth = suggestions.find(s => s.interval === '5th');
        expect(fifth).toBeDefined();
        expect(fifth!.midiNote).toBe(69); // A4
        expect(fifth!.semitonesFromRoot).toBe(7);
    });

    it('should always include an octave suggestion', () => {
        const suggestions = getHarmonyIntervals(60, 'C', 'major');
        const octave = suggestions.find(s => s.interval === 'octave');
        expect(octave).toBeDefined();
        expect(octave!.midiNote).toBe(72); // C5
        expect(octave!.semitonesFromRoot).toBe(12);
    });

    it('should use chromatic fallback for notes outside the scale', () => {
        // C# (MIDI 61) is not in C major
        const suggestions = getHarmonyIntervals(61, 'C', 'major');
        
        // Falls back to major 3rd (+4) and perfect 5th (+7)
        const third = suggestions.find(s => s.interval === '3rd');
        expect(third!.midiNote).toBe(65); // F4 (61+4)
        
        const fifth = suggestions.find(s => s.interval === '5th');
        expect(fifth!.midiNote).toBe(68); // G#4 (61+7)
    });

    it('should provide correct note names', () => {
        const suggestions = getHarmonyIntervals(60, 'C', 'major');
        const third = suggestions.find(s => s.interval === '3rd');
        expect(third!.noteName).toBe('E4');
    });

    it('should compute B3→D4 in C major (wrapping around scale)', () => {
        const suggestions = getHarmonyIntervals(59, 'C', 'major'); // B3 = MIDI 59
        // B is degree 6 in C major. 3rd above = degree 8 mod 7 = 1 → D
        const third = suggestions.find(s => s.interval === '3rd');
        expect(third).toBeDefined();
        expect(third!.midiNote).toBe(62); // D4
    });
});

// ── isHarmonyMatch ──────────────────────────────────────────────

describe('isHarmonyMatch', () => {
    it('should detect a perfect major 3rd', () => {
        const result = isHarmonyMatch(64, 60, 'C', 'major', 50); // E4 vs C4
        expect(result.isHarmony).toBe(true);
        expect(result.matchedInterval).toBe('3rd');
        expect(result.accuracy).toBe(100);
    });

    it('should detect a perfect 5th', () => {
        const result = isHarmonyMatch(67, 60, 'C', 'major', 50); // G4 vs C4
        expect(result.isHarmony).toBe(true);
        expect(result.matchedInterval).toBe('5th');
        expect(result.accuracy).toBe(100);
    });

    it('should detect an octave', () => {
        const result = isHarmonyMatch(72, 60, 'C', 'major', 50); // C5 vs C4
        expect(result.isHarmony).toBe(true);
        expect(result.matchedInterval).toBe('octave');
        expect(result.accuracy).toBe(100);
    });

    it('should reject a note that is not a harmony interval', () => {
        // C# (61) relative to C (60) is not a 3rd, 5th, or octave
        const result = isHarmonyMatch(61, 60, 'C', 'major', 50);
        expect(result.isHarmony).toBe(false);
        expect(result.matchedInterval).toBeNull();
    });

    it('should accept a slightly detuned harmony within tolerance', () => {
        // 63.8 is close to E4 (64) — within 50 cents
        const result = isHarmonyMatch(63.8, 60, 'C', 'major', 50);
        expect(result.isHarmony).toBe(true);
        expect(result.matchedInterval).toBe('3rd');
        expect(result.accuracy).toBeGreaterThan(0);
        expect(result.accuracy).toBeLessThan(100);
    });

    it('should reject a harmony that is outside tolerance', () => {
        // 63.3 is 70 cents from E4 (64) — outside 50 cent tolerance
        const result = isHarmonyMatch(63.3, 60, 'C', 'major', 50);
        expect(result.isHarmony).toBe(false);
    });
});
