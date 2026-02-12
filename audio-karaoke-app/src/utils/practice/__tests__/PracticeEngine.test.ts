import {
    PracticeEngine,
    detectDifficultSections,
    DEFAULT_PRACTICE_SETTINGS,
} from '../PracticeEngine';
import type { PitchAnalysisResult } from '@/types/audio';

// ─── Helpers ────────────────────────────────────────────────────────

/** Build a minimal PitchAnalysisResult at a given timestamp with given accuracy */
function frame(timestamp: number, accuracy: number): PitchAnalysisResult {
    return {
        detectedPitch: 440,
        detectedMidi: 69,
        referencePitch: 440,
        referenceMidi: 69,
        centDeviation: 0,
        accuracy,
        timestamp,
        confidence: 0.9,
    };
}

/** Generate a series of frames across time */
function makeHistory(
    entries: Array<{ from: number; to: number; accuracy: number; step?: number }>,
): PitchAnalysisResult[] {
    const history: PitchAnalysisResult[] = [];
    for (const { from, to, accuracy, step = 0.1 } of entries) {
        for (let t = from; t <= to; t += step) {
            history.push(frame(Math.round(t * 100) / 100, accuracy));
        }
    }
    return history;
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('detectDifficultSections', () => {
    it('returns empty array for no history', () => {
        expect(detectDifficultSections([])).toEqual([]);
    });

    it('returns empty when all frames are above threshold', () => {
        const history = makeHistory([{ from: 0, to: 10, accuracy: 90 }]);
        expect(detectDifficultSections(history)).toEqual([]);
    });

    it('detects a difficult section below threshold', () => {
        const history = makeHistory([
            { from: 0, to: 5, accuracy: 90 },
            { from: 5.1, to: 10, accuracy: 30 },   // difficult
            { from: 10.1, to: 15, accuracy: 85 },
        ]);
        const sections = detectDifficultSections(history);
        expect(sections.length).toBeGreaterThanOrEqual(1);
        expect(sections[0].averageAccuracy).toBeLessThan(60);
        expect(sections[0].startTime).toBeGreaterThanOrEqual(5);
    });

    it('ignores frames without reference pitch', () => {
        const history: PitchAnalysisResult[] = [
            { ...frame(0, 30), referencePitch: 0 },
            { ...frame(1, 30), referencePitch: 0 },
            { ...frame(2, 30), referencePitch: 0 },
        ];
        expect(detectDifficultSections(history)).toEqual([]);
    });

    it('splits sections longer than maxSectionDuration', () => {
        const settings = { ...DEFAULT_PRACTICE_SETTINGS, maxSectionDuration: 5 };
        const history = makeHistory([{ from: 0, to: 12, accuracy: 25 }]);
        const sections = detectDifficultSections(history, settings);
        expect(sections.length).toBeGreaterThan(1);
    });

    it('skips sections shorter than minSectionDuration', () => {
        const settings = { ...DEFAULT_PRACTICE_SETTINGS, minSectionDuration: 3 };
        const history = makeHistory([
            { from: 0, to: 5, accuracy: 90 },
            { from: 5.1, to: 6, accuracy: 20 },  // too short
            { from: 6.1, to: 10, accuracy: 90 },
        ]);
        const sections = detectDifficultSections(history, settings);
        expect(sections.length).toBe(0);
    });

    it('sorts sections by accuracy ascending', () => {
        const history = makeHistory([
            { from: 0, to: 4, accuracy: 50 },
            { from: 4.1, to: 5, accuracy: 90 },
            { from: 5.1, to: 9, accuracy: 20 },
        ]);
        const sections = detectDifficultSections(history);
        expect(sections.length).toBe(2);
        expect(sections[0].averageAccuracy).toBeLessThanOrEqual(sections[1].averageAccuracy);
    });
});

describe('PracticeEngine', () => {
    it('begins with sections from history', () => {
        const engine = new PracticeEngine();
        const history = makeHistory([
            { from: 0, to: 5, accuracy: 90 },
            { from: 5.1, to: 10, accuracy: 30 },
        ]);
        const state = engine.begin(history);
        expect(state.isPracticing).toBe(true);
        expect(state.sections.length).toBeGreaterThanOrEqual(1);
        expect(state.currentIndex).toBe(0);
        expect(state.attemptNumber).toBe(1);
    });

    it('marks complete when no difficult sections found', () => {
        const engine = new PracticeEngine();
        const history = makeHistory([{ from: 0, to: 10, accuracy: 95 }]);
        const state = engine.begin(history);
        expect(state.isPracticing).toBe(false);
        expect(state.isComplete).toBe(true);
        expect(state.sections).toEqual([]);
    });

    it('advances to next section when threshold met', () => {
        const engine = new PracticeEngine({ advanceThreshold: 80 });
        const history = makeHistory([
            { from: 0, to: 5, accuracy: 30 },
            { from: 5.1, to: 6, accuracy: 90 },
            { from: 6.1, to: 11, accuracy: 40 },
        ]);
        engine.begin(history);
        const state = engine.recordAttempt(85); // meets threshold
        expect(state.currentIndex).toBe(1);
        expect(state.attemptNumber).toBe(1);
    });

    it('advances after maxAttempts', () => {
        const engine = new PracticeEngine({ maxAttempts: 3 });
        const history = makeHistory([
            { from: 0, to: 5, accuracy: 20 },
            { from: 5.1, to: 6, accuracy: 90 },
            { from: 6.1, to: 11, accuracy: 30 },
        ]);
        engine.begin(history);
        engine.recordAttempt(30);
        engine.recordAttempt(35);
        const state = engine.recordAttempt(40); // 3rd attempt → advance
        expect(state.currentIndex).toBe(1);
    });

    it('increases tempo with each attempt', () => {
        const engine = new PracticeEngine({
            initialTempoFactor: 0.7,
            tempoStepUp: 0.1,
            advanceThreshold: 95,
            maxAttempts: 10,
        });
        const history = makeHistory([{ from: 0, to: 5, accuracy: 20 }]);
        engine.begin(history);
        const s1 = engine.recordAttempt(50);
        expect(s1.currentTempo).toBeCloseTo(0.8);
        const s2 = engine.recordAttempt(55);
        expect(s2.currentTempo).toBeCloseTo(0.9);
    });

    it('caps tempo at 1.0', () => {
        const engine = new PracticeEngine({
            initialTempoFactor: 0.9,
            tempoStepUp: 0.2,
            advanceThreshold: 95,
            maxAttempts: 10,
        });
        const history = makeHistory([{ from: 0, to: 5, accuracy: 20 }]);
        engine.begin(history);
        const state = engine.recordAttempt(50);
        expect(state.currentTempo).toBeLessThanOrEqual(1.0);
    });

    it('skip advances to next section', () => {
        const engine = new PracticeEngine();
        const history = makeHistory([
            { from: 0, to: 5, accuracy: 30 },
            { from: 5.1, to: 6, accuracy: 90 },
            { from: 6.1, to: 11, accuracy: 40 },
        ]);
        engine.begin(history);
        const state = engine.advance();
        expect(state.currentIndex).toBe(1);
    });

    it('marks complete when last section is advanced past', () => {
        const engine = new PracticeEngine();
        const history = makeHistory([{ from: 0, to: 5, accuracy: 20 }]);
        engine.begin(history);
        const state = engine.advance();
        expect(state.isPracticing).toBe(false);
        expect(state.isComplete).toBe(true);
    });

    it('stop sets isPracticing to false', () => {
        const engine = new PracticeEngine();
        const history = makeHistory([{ from: 0, to: 5, accuracy: 20 }]);
        engine.begin(history);
        const state = engine.stop();
        expect(state.isPracticing).toBe(false);
    });

    it('calculates overall improvement', () => {
        const engine = new PracticeEngine({ advanceThreshold: 95, maxAttempts: 10 });
        const history = makeHistory([{ from: 0, to: 5, accuracy: 20 }]);
        engine.begin(history);
        engine.recordAttempt(40);
        engine.recordAttempt(60);
        const improvement = engine.getOverallImprovement();
        expect(improvement).toBe(20); // 60 - 40
    });
});
