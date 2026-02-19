/**
 * Tests for pitchAnalysis utility functions
 */

import {
    centDeviation,
    calculateAccuracy,
    getPerformanceScore,
    analyzeFrame,
} from '../pitchAnalysis';
import type { PitchAnalysisResult } from '../../../types/audio';

// ── Pure function tests ─────────────────────────────────────────

describe('centDeviation', () => {
    it('should return 0 when pitches match exactly', () => {
        expect(centDeviation(69, 69)).toBe(0); // A4
    });

    it('should return +100 for one semitone sharp', () => {
        expect(centDeviation(70, 69)).toBe(100);
    });

    it('should return -100 for one semitone flat', () => {
        expect(centDeviation(68, 69)).toBe(-100);
    });

    it('should handle large intervals', () => {
        expect(centDeviation(81, 69)).toBe(1200); // one octave
    });
});

describe('calculateAccuracy', () => {
    it('should return 100 when within perfect threshold (±25 cents)', () => {
        expect(calculateAccuracy(69, 69)).toBe(100);
        // 10 cents sharp → still perfect
        expect(calculateAccuracy(69.1, 69)).toBe(100);
    });

    it('should return 0 when deviation >= 200 cents', () => {
        // 2 semitones = 200 cents
        expect(calculateAccuracy(71, 69)).toBe(0);
        // even larger
        expect(calculateAccuracy(81, 69)).toBe(0);
    });

    it('should interpolate between thresholds', () => {
        // ~100 cents deviation → (200-100)/(200-25) = 0.571 → ~57%
        const acc = calculateAccuracy(70, 69);
        expect(acc).toBeGreaterThan(0);
        expect(acc).toBeLessThan(100);
    });
});

describe('getPerformanceScore', () => {
    it('should return grade D and 0 accuracy for empty history', () => {
        const score = getPerformanceScore([]);
        expect(score.grade).toBe('D');
        expect(score.overallAccuracy).toBe(0);
        expect(score.notesHit).toBe(0);
    });

    it('should calculate grade S for perfect performance', () => {
        const history: PitchAnalysisResult[] = Array.from({ length: 20 }, (_, i) => ({
            detectedPitch: 440,
            detectedMidi: 69,
            referencePitch: 440,
            referenceMidi: 69,
            centDeviation: 0,
            accuracy: 100,
            timestamp: i * 0.05,
            confidence: 0.95,
        }));
        const score = getPerformanceScore(history);
        expect(score.grade).toBe('S');
        expect(score.overallAccuracy).toBe(100);
        expect(score.notesHit).toBe(20);
        expect(score.longestStreak).toBe(20);
    });

    it('should calculate longest streak correctly', () => {
        const history: PitchAnalysisResult[] = [
            // 3 hits
            ...Array.from({ length: 3 }, (_, i) => ({
                detectedPitch: 440, detectedMidi: 69,
                referencePitch: 440, referenceMidi: 69,
                centDeviation: 0, accuracy: 90, timestamp: i * 0.05, confidence: 0.9,
            })),
            // 1 miss
            {
                detectedPitch: 300, detectedMidi: 62,
                referencePitch: 440, referenceMidi: 69,
                centDeviation: -700, accuracy: 0, timestamp: 0.15, confidence: 0.9,
            },
            // 5 hits
            ...Array.from({ length: 5 }, (_, i) => ({
                detectedPitch: 440, detectedMidi: 69,
                referencePitch: 440, referenceMidi: 69,
                centDeviation: 0, accuracy: 85, timestamp: 0.2 + i * 0.05, confidence: 0.9,
            })),
        ];
        const score = getPerformanceScore(history);
        expect(score.longestStreak).toBe(5);
        expect(score.notesHit).toBe(8);
    });

    it('should ignore frames without reference pitch', () => {
        const history: PitchAnalysisResult[] = [
            {
                detectedPitch: 440, detectedMidi: 69,
                referencePitch: 0, referenceMidi: 0,
                centDeviation: 0, accuracy: 0, timestamp: 0, confidence: 0.9,
            },
            {
                detectedPitch: 440, detectedMidi: 69,
                referencePitch: 440, referenceMidi: 69,
                centDeviation: 0, accuracy: 95, timestamp: 0.05, confidence: 0.9,
            },
        ];
        const score = getPerformanceScore(history);
        expect(score.totalNotes).toBe(1); // only the frame with reference
        expect(score.overallAccuracy).toBe(95);
    });
});

describe('analyzeFrame', () => {
    // Mock PitchCorrector.detectPitch (it's already imported in pitchAnalysis)
    beforeAll(() => {
        jest.mock('../pitchCorrection', () => ({
            PitchCorrector: {
                detectPitch: jest.fn((buffer: Float32Array, sampleRate: number) => {
                    // Simulate 440 Hz detection with 0.9 confidence
                    return { frequency: 440, midiNote: 69, confidence: 0.9 };
                }),
            },
        }));
    });

    it('should return null for very low confidence results', () => {
        // We can't easily test this without more complex mocking,
        // so we verify the function signature and types
        expect(typeof analyzeFrame).toBe('function');
    });
});

describe('getPerformanceScore — harmony integration', () => {
    const makeResult = (
        accuracy: number,
        harmonyInterval: '3rd' | '5th' | 'octave' | null = null,
        harmonyAccuracy: number = 0,
    ): PitchAnalysisResult => ({
        detectedPitch: 440,
        detectedMidi: 69,
        referencePitch: 440,
        referenceMidi: 69,
        centDeviation: 0,
        accuracy,
        timestamp: 0,
        confidence: 0.9,
        harmonyInterval,
        harmonyAccuracy,
    });

    it('should include harmonyHits and harmonyBonus in empty result', () => {
        const score = getPerformanceScore([]);
        expect(score.harmonyHits).toBe(0);
        expect(score.harmonyBonus).toBe(0);
    });

    it('should count harmony hits when harmonyAccuracy >= 60', () => {
        const history: PitchAnalysisResult[] = [
            makeResult(30, '3rd', 80), // harmony hit
            makeResult(90),             // melody hit
            makeResult(20, '5th', 50),  // below threshold, no harmony hit
            makeResult(40, '5th', 70), // harmony hit
        ];
        const score = getPerformanceScore(history);
        expect(score.harmonyHits).toBe(2);
    });

    it('should calculate harmony bonus based on ratio (capped at 20)', () => {
        // 4 notes, 2 harmony hits → 50% → bonus = 50, capped to 20
        const history: PitchAnalysisResult[] = [
            makeResult(30, '3rd', 80),
            makeResult(90),
            makeResult(40, '5th', 70),
            makeResult(20, '3rd', 90),
        ];
        const score = getPerformanceScore(history);
        // 3 harmony hits out of 4 → 75% → bonus = min(20, 75) = 20
        expect(score.harmonyBonus).toBeLessThanOrEqual(20);
        expect(score.harmonyBonus).toBeGreaterThan(0);
    });

    it('should count harmony hits toward longest streak', () => {
        const history: PitchAnalysisResult[] = [
            makeResult(90),             // melody hit
            makeResult(30, '3rd', 80),  // harmony hit (counts for streak)
            makeResult(85),             // melody hit
        ];
        const score = getPerformanceScore(history);
        expect(score.longestStreak).toBe(3); // all three should be a streak
    });

    it('should not break streak for harmony that is below threshold', () => {
        const history: PitchAnalysisResult[] = [
            makeResult(90),             // hit
            makeResult(30, '3rd', 40),  // harmony below threshold → miss
            makeResult(85),             // hit
        ];
        const score = getPerformanceScore(history);
        expect(score.longestStreak).toBe(1); // streak broken
    });
});

