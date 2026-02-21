'use client';

/**
 * usePitchAnalysis — React hook for real-time vocal performance tracking.
 *
 * Requests microphone access, runs pitch detection on the mic stream,
 * compares against a reference vocal buffer from PlaybackController,
 * and exposes real-time scoring data.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { PitchAnalysisResult, PerformanceScore } from '@/types/audio';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import type { KeyInfo } from '@/utils/audio/keyDetection';

interface PitchAnalysisState {
    isListening: boolean;
    currentPitch: number;          // Hz
    currentScore: number;          // 0–100
    currentCombo: number;
    lastHitType: 'perfect' | 'great' | 'good' | 'miss' | null;
    overallScore: PerformanceScore | null;
    pitchHistory: PitchAnalysisResult[];
    error: string | null;
}

export function usePitchAnalysis(controller: PlaybackController, keyInfo?: KeyInfo | null) {
    const [state, setState] = useState<PitchAnalysisState>({
        isListening: false,
        currentPitch: 0,
        currentScore: 0,
        currentCombo: 0,
        lastHitType: null,
        overallScore: null,
        pitchHistory: [],
        error: null,
    });

    const comboRef = useRef<number>(0);
    const pendingUpdateRef = useRef<boolean>(false);
    const animationFrameRef = useRef<number | null>(null);

    // Start analysis delegating to controller
    const startAnalysis = useCallback(async () => {
        try {
            await controller.startMicAnalysis();
            // State update handled by events below
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Microphone access denied';
            setState(prev => ({ ...prev, error: message }));
        }
    }, [controller]);

    // Stop analysis delegating to controller
    const stopAnalysis = useCallback(() => {
        controller.stopMicAnalysis();
        const score = controller.getPerformanceScore();

        setState(prev => ({
            ...prev,
            isListening: false,
            overallScore: score,
            pitchHistory: controller.getPerformanceHistory()
        }));
    }, [controller]);

    // Reset
    const resetAnalysis = useCallback(() => {
        // controller doesn't have a resetMicAnalysis yet, but we can just stop and clear history if needed
        // For now, we'll just reset local state if analysis is stopped.
        if (!state.isListening) {
             comboRef.current = 0;
             setState({
                 isListening: false,
                 currentPitch: 0,
                 currentScore: 0,
                 currentCombo: 0,
                 lastHitType: null,
                 overallScore: null,
                 pitchHistory: [],
                 error: null,
             });
        }
    }, [state.isListening]);

    // Wire up events from controller
    useEffect(() => {
        const handlePitch = (result: PitchAnalysisResult) => {
            // Combo Logic
            const isHit = result.accuracy >= 70 || (result.harmonyInterval !== null && result.harmonyAccuracy >= 60);
            if (isHit) {
                comboRef.current++;
            } else if (result.referencePitch > 0) {
                comboRef.current = 0;
            }

            let hitType: 'perfect' | 'great' | 'good' | 'miss' | null = null;
            if (isHit) {
                if (result.accuracy >= 95) hitType = 'perfect';
                else if (result.accuracy >= 85) hitType = 'great';
                else hitType = 'good';
            } else if (result.referencePitch > 0) {
                hitType = 'miss';
            }

            if (!pendingUpdateRef.current) {
                pendingUpdateRef.current = true;
                animationFrameRef.current = requestAnimationFrame(() => {
                    pendingUpdateRef.current = false;
                    const history = controller.getPerformanceHistory();
                    const visibleWindow = history.slice(-300);
                    
                    setState(prev => ({
                        ...prev,
                        isListening: true, // Pulse listening state
                        currentPitch: result.detectedPitch,
                        currentScore: result.accuracy,
                        currentCombo: comboRef.current,
                        lastHitType: hitType,
                        pitchHistory: visibleWindow,
                    }));
                });
            }
        };

        const handleMicStarted = () => {
            setState(prev => ({ ...prev, isListening: true, error: null }));
        };

        const handleMicStopped = () => {
            setState(prev => ({ ...prev, isListening: false }));
        };

        controller.on('pitch-analysis', handlePitch as (data: unknown) => void);
        controller.on('mic-started', handleMicStarted);
        controller.on('mic-stopped', handleMicStopped);

        return () => {
            controller.off('pitch-analysis', handlePitch as (data: unknown) => void);
            controller.off('mic-started', handleMicStarted);
            controller.off('mic-stopped', handleMicStopped);
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [controller]);

    return {
        ...state,
        startAnalysis,
        stopAnalysis,
        resetAnalysis,
    };
}
