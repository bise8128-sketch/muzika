'use client';

/**
 * useHarmonyGuide — React hook for real-time harmony suggestions.
 *
 * Bridges the detected key from useAutoKey to the pure harmonyGuide
 * utility, exposing live harmony suggestions and match state per frame.
 */

import { useState, useCallback, useMemo } from 'react';
import type { KeyInfo } from '@/utils/audio/keyDetection';
import {
    getHarmonyIntervals,
    isHarmonyMatch,
    type HarmonySuggestion,
    type HarmonyMatchResult,
    type HarmonyInterval,
} from '@/utils/audio/harmonyGuide';

interface HarmonyGuideState {
    harmonyEnabled: boolean;
    currentSuggestions: HarmonySuggestion[];
    lastMatch: HarmonyMatchResult | null;
    totalHarmonyHits: number;
}

export function useHarmonyGuide(detectedKey: KeyInfo | null) {
    const [harmonyEnabled, setHarmonyEnabled] = useState(false);
    const [lastMatch, setLastMatch] = useState<HarmonyMatchResult | null>(null);
    const [totalHarmonyHits, setTotalHarmonyHits] = useState(0);

    /**
     * Get harmony suggestions for a given reference MIDI note.
     * Memoized based on the detected key — suggestions only recalculate
     * when the key or reference note changes.
     */
    const getSuggestions = useCallback(
        (referenceMidi: number): HarmonySuggestion[] => {
            if (!detectedKey || !harmonyEnabled || referenceMidi <= 0) {
                return [];
            }
            return getHarmonyIntervals(
                referenceMidi,
                detectedKey.tonic,
                detectedKey.scale,
            );
        },
        [detectedKey, harmonyEnabled],
    );

    /**
     * Check if the user's detected pitch matches a harmony interval.
     * Call this from the analysis loop for real-time feedback.
     */
    const checkHarmony = useCallback(
        (detectedMidi: number, referenceMidi: number): HarmonyMatchResult => {
            if (!detectedKey || !harmonyEnabled || referenceMidi <= 0) {
                return { isHarmony: false, matchedInterval: null, accuracy: 0 };
            }

            const result = isHarmonyMatch(
                detectedMidi,
                referenceMidi,
                detectedKey.tonic,
                detectedKey.scale,
            );

            setLastMatch(result);
            if (result.isHarmony) {
                setTotalHarmonyHits(prev => prev + 1);
            }

            return result;
        },
        [detectedKey, harmonyEnabled],
    );

    /**
     * Reset match state (e.g. when starting a new analysis session)
     */
    const resetHarmony = useCallback(() => {
        setLastMatch(null);
        setTotalHarmonyHits(0);
    }, []);

    /**
     * The key info to pass to analyzeFrame when harmony is enabled.
     * Returns null when harmony mode is off (scoring engine skips harmony detection).
     */
    const activeKeyInfo = useMemo(
        () => (harmonyEnabled ? detectedKey : null),
        [harmonyEnabled, detectedKey],
    );

    return {
        harmonyEnabled,
        setHarmonyEnabled,
        lastMatch,
        totalHarmonyHits,
        getSuggestions,
        checkHarmony,
        resetHarmony,
        activeKeyInfo,
    };
}
