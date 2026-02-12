/**
 * PracticeEngine — Adaptive practice system for karaoke.
 *
 * Analyses pitch-analysis history to find difficult sections, queues them for
 * repeated practice with adaptive tempo, and tracks per-attempt accuracy.
 */

import type {
    PitchAnalysisResult,
    DifficultSection,
    PracticeSettings,
    PracticeAttempt,
} from '@/types/audio';

// ─── Defaults ───────────────────────────────────────────────────────

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
    accuracyThreshold: 60,
    minSectionDuration: 2,
    maxSectionDuration: 15,
    initialTempoFactor: 0.7,
    tempoStepUp: 0.1,
    advanceThreshold: 80,
    maxAttempts: 10,
    leadInSeconds: 1,
};

// ─── Section Detection ──────────────────────────────────────────────

/** Format seconds as m:ss */
function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Scan the pitch-analysis history and return contiguous sections that
 * fall below the accuracy threshold.
 */
export function detectDifficultSections(
    history: PitchAnalysisResult[],
    settings: PracticeSettings = DEFAULT_PRACTICE_SETTINGS,
): DifficultSection[] {
    if (history.length === 0) return [];

    // Only consider frames that had a valid reference pitch
    const scored = history.filter(h => h.referencePitch > 0);
    if (scored.length === 0) return [];

    const raw: DifficultSection[] = [];
    let runStart = -1;
    let runFrames: PitchAnalysisResult[] = [];

    const flush = () => {
        if (runFrames.length === 0) return;
        const start = runFrames[0].timestamp;
        const end = runFrames[runFrames.length - 1].timestamp;
        const duration = end - start;

        if (duration >= settings.minSectionDuration) {
            const avgAcc =
                runFrames.reduce((s, f) => s + f.accuracy, 0) / runFrames.length;

            // Clamp to maxSectionDuration — split if needed
            const chunks = Math.ceil(duration / settings.maxSectionDuration);
            const framesPerChunk = Math.ceil(runFrames.length / chunks);

            for (let c = 0; c < chunks; c++) {
                const chunkFrames = runFrames.slice(
                    c * framesPerChunk,
                    (c + 1) * framesPerChunk,
                );
                if (chunkFrames.length === 0) continue;
                const cStart = chunkFrames[0].timestamp;
                const cEnd = chunkFrames[chunkFrames.length - 1].timestamp;
                const cAvg =
                    chunkFrames.reduce((s, f) => s + f.accuracy, 0) /
                    chunkFrames.length;

                raw.push({
                    id: `section-${raw.length}`,
                    startTime: cStart,
                    endTime: cEnd,
                    averageAccuracy: Math.round(cAvg),
                    frameCount: chunkFrames.length,
                    label: `${formatTime(cStart)} – ${formatTime(cEnd)}`,
                });
            }
        }
        runFrames = [];
        runStart = -1;
    };

    for (const frame of scored) {
        if (frame.accuracy < settings.accuracyThreshold) {
            if (runStart < 0) runStart = frame.timestamp;
            runFrames.push(frame);
        } else {
            flush();
        }
    }
    flush(); // close any trailing run

    // Sort by accuracy ascending (worst first)
    raw.sort((a, b) => a.averageAccuracy - b.averageAccuracy);

    return raw;
}

// ─── Practice Engine ────────────────────────────────────────────────

export interface PracticeEngineState {
    sections: DifficultSection[];
    currentIndex: number;
    attemptNumber: number;
    currentTempo: number;
    attempts: PracticeAttempt[];
    isPracticing: boolean;
    isComplete: boolean;
}

export class PracticeEngine {
    private settings: PracticeSettings;
    private state: PracticeEngineState;

    constructor(settings: Partial<PracticeSettings> = {}) {
        this.settings = { ...DEFAULT_PRACTICE_SETTINGS, ...settings };
        this.state = this.emptyState();
    }

    private emptyState(): PracticeEngineState {
        return {
            sections: [],
            currentIndex: 0,
            attemptNumber: 1,
            currentTempo: this.settings.initialTempoFactor,
            attempts: [],
            isPracticing: false,
            isComplete: false,
        };
    }

    /** Initialise from pitch analysis history. */
    begin(history: PitchAnalysisResult[]): PracticeEngineState {
        const sections = detectDifficultSections(history, this.settings);
        this.state = {
            ...this.emptyState(),
            sections,
            isPracticing: sections.length > 0,
            isComplete: sections.length === 0,
        };
        return this.getState();
    }

    /** Get the current section (or null if done). */
    getCurrentSection(): DifficultSection | null {
        if (this.state.currentIndex >= this.state.sections.length) return null;
        return this.state.sections[this.state.currentIndex];
    }

    /** The time at which the player should start (includes lead-in). */
    getSectionStartTime(): number {
        const section = this.getCurrentSection();
        if (!section) return 0;
        return Math.max(0, section.startTime - this.settings.leadInSeconds);
    }

    /** Record an attempt result for the current section. */
    recordAttempt(accuracy: number): PracticeEngineState {
        const section = this.getCurrentSection();
        if (!section) return this.getState();

        const attempt: PracticeAttempt = {
            sectionId: section.id,
            attemptNumber: this.state.attemptNumber,
            accuracy: Math.round(accuracy),
            tempo: this.state.currentTempo,
            timestamp: Date.now(),
        };
        this.state.attempts.push(attempt);

        // Check if mastered or max attempts reached
        if (
            accuracy >= this.settings.advanceThreshold ||
            this.state.attemptNumber >= this.settings.maxAttempts
        ) {
            return this.advance();
        }

        // Increase tempo towards 1.0 if improving
        const newTempo = Math.min(
            1.0,
            this.state.currentTempo + this.settings.tempoStepUp,
        );
        this.state.attemptNumber += 1;
        this.state.currentTempo = newTempo;

        return this.getState();
    }

    /** Skip to next section. */
    advance(): PracticeEngineState {
        this.state.currentIndex += 1;
        this.state.attemptNumber = 1;
        this.state.currentTempo = this.settings.initialTempoFactor;

        if (this.state.currentIndex >= this.state.sections.length) {
            this.state.isPracticing = false;
            this.state.isComplete = true;
        }
        return this.getState();
    }

    /** Update settings on the fly. */
    updateSettings(partial: Partial<PracticeSettings>): void {
        this.settings = { ...this.settings, ...partial };
    }

    /** Stop practice. */
    stop(): PracticeEngineState {
        this.state.isPracticing = false;
        return this.getState();
    }

    /** Get a read-only snapshot. */
    getState(): PracticeEngineState {
        return { ...this.state };
    }

    /** Compute overall improvement: accuracy delta first vs last attempt across all sections. */
    getOverallImprovement(): number {
        const bySection = new Map<string, PracticeAttempt[]>();
        for (const a of this.state.attempts) {
            const list = bySection.get(a.sectionId) ?? [];
            list.push(a);
            bySection.set(a.sectionId, list);
        }

        let totalDelta = 0;
        let count = 0;
        for (const [, attempts] of bySection) {
            if (attempts.length >= 2) {
                totalDelta += attempts[attempts.length - 1].accuracy - attempts[0].accuracy;
                count++;
            }
        }
        return count > 0 ? Math.round(totalDelta / count) : 0;
    }
}
