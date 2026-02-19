/**
 * HarmonyGuide — Pure music theory utility for harmony interval suggestions.
 *
 * Computes diatonic harmony intervals (3rd, 5th, octave) based on the
 * detected key and provides matching logic used by the scoring engine.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type HarmonyInterval = '3rd' | '5th' | 'octave';

export interface HarmonySuggestion {
    interval: HarmonyInterval;
    midiNote: number;           // Target MIDI note for the harmony
    noteName: string;           // e.g. "E4"
    semitonesFromRoot: number;  // Chromatic distance from the reference
}

export interface HarmonyMatchResult {
    isHarmony: boolean;
    matchedInterval: HarmonyInterval | null;
    accuracy: number;           // 0–100 (how close to the ideal harmony)
}

// ─── Constants ──────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Semitone intervals from root for major and minor scales */
const SCALE_INTERVALS: Record<'major' | 'minor', number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
};

/** Default harmony tolerance in cents */
const DEFAULT_TOLERANCE_CENTS = 50;

// ─── Helpers ────────────────────────────────────────────────────────

/** Convert a tonic name (e.g. "C#") to its pitch-class index (0–11) */
function tonicToIndex(tonic: string): number {
    const idx = NOTE_NAMES.indexOf(tonic);
    return idx >= 0 ? idx : 0;
}

/** Get the note name and octave for a MIDI note */
function midiToNoteName(midi: number): string {
    const noteIndex = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return `${NOTE_NAMES[noteIndex]}${octave}`;
}

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Build the 7 pitch-classes for a given key.
 *
 * @returns Array of 7 pitch-class indices (0–11) starting from the tonic
 *
 * @example
 *   getScaleNotes('C', 'major') → [0, 2, 4, 5, 7, 9, 11]
 *   getScaleNotes('A', 'minor') → [9, 11, 0, 2, 4, 5, 7]
 */
export function getScaleNotes(tonic: string, scale: 'major' | 'minor'): number[] {
    const root = tonicToIndex(tonic);
    return SCALE_INTERVALS[scale].map(interval => (root + interval) % 12);
}

/**
 * Given a scale (as pitch-class array), find the scale-degree index
 * for a MIDI pitch. Returns -1 if the note is not in the scale.
 */
function scaleDegreeOf(midi: number, scaleNotes: number[]): number {
    const pc = ((midi % 12) + 12) % 12;
    return scaleNotes.indexOf(pc);
}

/**
 * Compute harmony suggestions (3rd, 5th, octave) for a reference MIDI note,
 * using **diatonic** intervals within the detected scale.
 *
 * Diatonic means we count scale steps, not chromatic half-steps:
 * - 3rd = 2 scale steps above  (e.g. C→E in C major, D→F in C major)
 * - 5th = 4 scale steps above  (e.g. C→G in C major, D→A in C major)
 * - octave = +12 semitones
 */
export function getHarmonyIntervals(
    referenceMidi: number,
    tonic: string,
    scale: 'major' | 'minor',
): HarmonySuggestion[] {
    const scaleNotes = getScaleNotes(tonic, scale);
    const degree = scaleDegreeOf(referenceMidi, scaleNotes);

    // If the reference note isn't in the scale, we can still suggest the octave
    // and fall back to chromatic 3rd/5th
    const suggestions: HarmonySuggestion[] = [];

    if (degree >= 0) {
        // Diatonic 3rd: 2 scale steps up
        const thirdDegree = (degree + 2) % 7;
        const thirdPc = scaleNotes[thirdDegree];
        const thirdMidi = referenceMidi + ((thirdPc - (referenceMidi % 12) + 12) % 12);
        // Ensure the harmony is above the reference
        const thirdFinal = thirdMidi <= referenceMidi ? thirdMidi + 12 : thirdMidi;

        suggestions.push({
            interval: '3rd',
            midiNote: thirdFinal,
            noteName: midiToNoteName(thirdFinal),
            semitonesFromRoot: thirdFinal - referenceMidi,
        });

        // Diatonic 5th: 4 scale steps up
        const fifthDegree = (degree + 4) % 7;
        const fifthPc = scaleNotes[fifthDegree];
        const fifthMidi = referenceMidi + ((fifthPc - (referenceMidi % 12) + 12) % 12);
        const fifthFinal = fifthMidi <= referenceMidi ? fifthMidi + 12 : fifthMidi;

        suggestions.push({
            interval: '5th',
            midiNote: fifthFinal,
            noteName: midiToNoteName(fifthFinal),
            semitonesFromRoot: fifthFinal - referenceMidi,
        });
    } else {
        // Chromatic fallback: major 3rd (+4) and perfect 5th (+7)
        suggestions.push({
            interval: '3rd',
            midiNote: referenceMidi + 4,
            noteName: midiToNoteName(referenceMidi + 4),
            semitonesFromRoot: 4,
        });
        suggestions.push({
            interval: '5th',
            midiNote: referenceMidi + 7,
            noteName: midiToNoteName(referenceMidi + 7),
            semitonesFromRoot: 7,
        });
    }

    // Octave is always +12
    suggestions.push({
        interval: 'octave',
        midiNote: referenceMidi + 12,
        noteName: midiToNoteName(referenceMidi + 12),
        semitonesFromRoot: 12,
    });

    return suggestions;
}

/**
 * Check whether a detected MIDI pitch matches any valid harmony interval
 * of the reference pitch, within a tolerance in cents.
 *
 * @param toleranceCents Maximum deviation (default 50 = half a semitone)
 */
export function isHarmonyMatch(
    detectedMidi: number,
    referenceMidi: number,
    tonic: string,
    scale: 'major' | 'minor',
    toleranceCents: number = DEFAULT_TOLERANCE_CENTS,
): HarmonyMatchResult {
    const suggestions = getHarmonyIntervals(referenceMidi, tonic, scale);
    const toleranceSemitones = toleranceCents / 100;

    let bestMatch: HarmonyMatchResult = {
        isHarmony: false,
        matchedInterval: null,
        accuracy: 0,
    };

    for (const suggestion of suggestions) {
        const deviation = Math.abs(detectedMidi - suggestion.midiNote);

        if (deviation <= toleranceSemitones) {
            // Convert deviation to accuracy: 0 cents = 100%, toleranceCents = 0%
            const deviationCents = deviation * 100;
            const accuracy = Math.round(100 * (1 - deviationCents / toleranceCents));

            if (accuracy > bestMatch.accuracy) {
                bestMatch = {
                    isHarmony: true,
                    matchedInterval: suggestion.interval,
                    accuracy,
                };
            }
        }
    }

    return bestMatch;
}
