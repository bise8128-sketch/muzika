'use client';

/**
 * usePractice — React hook for Smart Practice Mode.
 *
 * Wraps PracticeEngine and bridges it with the PlaybackController,
 * automatically seeking / looping / adjusting tempo for each section.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { PitchAnalysisResult, DifficultSection, PracticeSettings } from '@/types/audio';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import {
    PracticeEngine,
    PracticeEngineState,
    DEFAULT_PRACTICE_SETTINGS,
} from '@/utils/practice/PracticeEngine';

export interface UsePracticeReturn {
    /** Whether practice mode is active */
    isPracticing: boolean;
    /** Whether all sections are completed */
    isComplete: boolean;
    /** List of detected difficult sections */
    sections: DifficultSection[];
    /** Index of the section currently being practiced */
    currentIndex: number;
    /** Current attempt number for the active section */
    attemptNumber: number;
    /** Active tempo multiplier */
    currentTempo: number;
    /** Current section being practiced */
    currentSection: DifficultSection | null;
    /** Overall accuracy improvement (%) across the session */
    overallImprovement: number;
    /** Start practice from pitch analysis results */
    startPractice: (history: PitchAnalysisResult[]) => void;
    /** Record an attempt score for the current section */
    recordAttempt: (accuracy: number) => void;
    /** Skip to the next section */
    skipSection: () => void;
    /** Stop practice mode */
    stopPractice: () => void;
}

export function usePractice(
    controller: PlaybackController | null,
    settings: Partial<PracticeSettings> = {},
): UsePracticeReturn {
    const engineRef = useRef<PracticeEngine>(new PracticeEngine(settings));

    const [state, setState] = useState<PracticeEngineState>(
        engineRef.current.getState(),
    );

    // Keep settings in sync
    useEffect(() => {
        engineRef.current.updateSettings(settings);
    }, [settings]);

    // Apply tempo + seek whenever the engine state changes during practice
    const applyToController = useCallback(
        (next: PracticeEngineState) => {
            if (!controller) return;
            if (!next.isPracticing) {
                // Restore original tempo when exiting practice
                controller.setTempo(1.0);
                return;
            }
            controller.setTempo(next.currentTempo);
            const section = engineRef.current.getCurrentSection();
            if (section) {
                controller.setCurrentTime(engineRef.current.getSectionStartTime());
                // Auto-play
                if (!controller.getIsPlaying()) {
                    controller.play();
                }
            }
        },
        [controller],
    );

    const startPractice = useCallback(
        (history: PitchAnalysisResult[]) => {
            const next = engineRef.current.begin(history);
            setState(next);
            applyToController(next);
        },
        [applyToController],
    );

    const recordAttempt = useCallback(
        (accuracy: number) => {
            const next = engineRef.current.recordAttempt(accuracy);
            setState(next);
            applyToController(next);
        },
        [applyToController],
    );

    const skipSection = useCallback(() => {
        const next = engineRef.current.advance();
        setState(next);
        applyToController(next);
    }, [applyToController]);

    const stopPractice = useCallback(() => {
        const next = engineRef.current.stop();
        setState(next);
        if (controller) controller.setTempo(1.0);
    }, [controller]);

    return {
        isPracticing: state.isPracticing,
        isComplete: state.isComplete,
        sections: state.sections,
        currentIndex: state.currentIndex,
        attemptNumber: state.attemptNumber,
        currentTempo: state.currentTempo,
        currentSection: engineRef.current.getCurrentSection(),
        overallImprovement: engineRef.current.getOverallImprovement(),
        startPractice,
        recordAttempt,
        skipSection,
        stopPractice,
    };
}
