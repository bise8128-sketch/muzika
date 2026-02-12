/**
 * PitchAnalyzer — Real-time vocal performance analysis engine.
 *
 * Reuses static methods from PitchCorrector (detectPitch, midiToFrequency,
 * frequencyToMidi) for pitch detection and provides accuracy scoring.
 */

import type {
    PitchAnalysisResult,
    PerformanceScore,
    PerformanceGrade,
} from '../../types/audio';
import { PitchCorrector } from './pitchCorrection';

// ─── Constants ──────────────────────────────────────────────────────

/** ±25 cents = 100 % accuracy, ±200 cents = 0 % */
const PERFECT_THRESHOLD_CENTS = 25;
const MAX_DEVIATION_CENTS = 200;

/** Minimum confidence from YIN detector to count as a valid note */
const MIN_CONFIDENCE = 0.5;

/** Grade thresholds (accuracy %) */
const GRADE_THRESHOLDS: { min: number; grade: PerformanceGrade }[] = [
    { min: 90, grade: 'S' },
    { min: 75, grade: 'A' },
    { min: 60, grade: 'B' },
    { min: 40, grade: 'C' },
    { min: 0, grade: 'D' },
];

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Calculate the cent deviation between two MIDI note numbers.
 * Returns a value in the range (-1200, 1200).
 */
export function centDeviation(detectedMidi: number, referenceMidi: number): number {
    return (detectedMidi - referenceMidi) * 100; // 1 semitone = 100 cents
}

/**
 * Convert cent deviation to an accuracy percentage (0–100).
 *
 * - Within ±PERFECT_THRESHOLD_CENTS → 100 %
 * - Beyond ±MAX_DEVIATION_CENTS → 0 %
 * - Linear interpolation in between
 */
export function calculateAccuracy(detectedMidi: number, referenceMidi: number): number {
    const deviation = Math.abs(centDeviation(detectedMidi, referenceMidi));
    if (deviation <= PERFECT_THRESHOLD_CENTS) return 100;
    if (deviation >= MAX_DEVIATION_CENTS) return 0;
    return Math.round(
        100 * (1 - (deviation - PERFECT_THRESHOLD_CENTS) / (MAX_DEVIATION_CENTS - PERFECT_THRESHOLD_CENTS))
    );
}

/**
 * Detect the pitch in a reference vocal buffer at a specific sample offset.
 * Extracts a window of `windowSize` samples around the offset.
 */
export function getReferencePitchAtTime(
    vocalBuffer: AudioBuffer,
    timeSec: number,
    windowSize: number = 4096,
): { pitch: number; midi: number } | null {
    const sr = vocalBuffer.sampleRate;
    const ch = vocalBuffer.getChannelData(0);
    const center = Math.floor(timeSec * sr);
    const half = Math.floor(windowSize / 2);
    const start = Math.max(0, center - half);
    const end = Math.min(ch.length, start + windowSize);

    if (end - start < 2048) return null; // too short to detect

    const window = ch.slice(start, end);
    const result = PitchCorrector.detectPitch(window, sr);
    if (!result || result.confidence < MIN_CONFIDENCE) return null;

    return { pitch: result.frequency, midi: result.midiNote };
}

/**
 * Analyse a single frame of microphone and reference audio.
 * Returns a PitchAnalysisResult or null if detection fails.
 */
export function analyzeFrame(
    micBuffer: Float32Array,
    refPitch: { pitch: number; midi: number } | null,
    sampleRate: number,
    timestamp: number,
): PitchAnalysisResult | null {
    const micResult = PitchCorrector.detectPitch(micBuffer, sampleRate);

    if (!micResult || micResult.confidence < MIN_CONFIDENCE) {
        // No detected pitch → skip
        return null;
    }

    const detectedPitch = micResult.frequency;
    const detectedMidi = micResult.midiNote;

    if (!refPitch) {
        // No reference at this time → can still report user's pitch
        return {
            detectedPitch,
            detectedMidi,
            referencePitch: 0,
            referenceMidi: 0,
            centDeviation: 0,
            accuracy: 0,
            timestamp,
            confidence: micResult.confidence,
        };
    }

    const cents = centDeviation(detectedMidi, refPitch.midi);
    const acc = calculateAccuracy(detectedMidi, refPitch.midi);

    return {
        detectedPitch,
        detectedMidi,
        referencePitch: refPitch.pitch,
        referenceMidi: refPitch.midi,
        centDeviation: cents,
        accuracy: acc,
        timestamp,
        confidence: micResult.confidence,
    };
}

/**
 * Compute an overall performance score from the full history of frames.
 */
export function getPerformanceScore(history: PitchAnalysisResult[]): PerformanceScore {
    if (history.length === 0) {
        return {
            overallAccuracy: 0,
            grade: 'D',
            notesHit: 0,
            totalNotes: 0,
            longestStreak: 0,
            history: [],
        };
    }

    // Only count frames where we had a valid reference
    const scored = history.filter(h => h.referencePitch > 0);
    const totalNotes = scored.length;
    const notesHit = scored.filter(h => h.accuracy >= 70).length;

    // Average accuracy
    const sumAccuracy = scored.reduce((sum, h) => sum + h.accuracy, 0);
    const overallAccuracy = totalNotes > 0 ? Math.round(sumAccuracy / totalNotes) : 0;

    // Longest streak of "hit" notes (accuracy >= 70)
    let longestStreak = 0;
    let currentStreak = 0;
    for (const h of scored) {
        if (h.accuracy >= 70) {
            currentStreak++;
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    }

    // Determine grade
    const grade = GRADE_THRESHOLDS.find(t => overallAccuracy >= t.min)?.grade ?? 'D';

    return {
        overallAccuracy,
        grade,
        notesHit,
        totalNotes,
        longestStreak,
        history,
    };
}
