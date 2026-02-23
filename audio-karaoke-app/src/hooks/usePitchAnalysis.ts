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

export function usePitchAnalysis(controller: PlaybackController) {
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

    const visibleWindowRef = useRef<PitchAnalysisResult[]>([]);
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

    // Stop analysis delegating to controller (now async to get final score from worker)
    const stopAnalysis = useCallback(async () => {
        controller.stopMicAnalysis();

        // Wait for worker to return the complete History and Score
        const finalData = await controller.getFinalPerformance();
        if (finalData) {
            setState(prev => ({
                ...prev,
                isListening: false,
                overallScore: finalData.overallScore,
                pitchHistory: finalData.history
            }));
        } else {
             // Fallback if worker failed or was already stopped
             setState(prev => ({
                 ...prev,
                 isListening: false
             }));
        }
    }, [controller]);

    // Reset
    const resetAnalysis = useCallback(() => {
        if (!state.isListening) {
             visibleWindowRef.current = [];
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
        const handlePitchUpdate = (payload: unknown) => {
            const { result, currentCombo, lastHitType } = payload as { result: PitchAnalysisResult, currentCombo: number, lastHitType: 'perfect' | 'great' | 'good' | 'miss' | null };

            // Maintain a small sliding window purely for the visualizer
            visibleWindowRef.current.push(result);
            if (visibleWindowRef.current.length > 300) {
                // Remove oldest elements to keep array length <= 300 without expensive slicing
                visibleWindowRef.current.splice(0, visibleWindowRef.current.length - 300);
            }

            if (!pendingUpdateRef.current) {
                pendingUpdateRef.current = true;
                animationFrameRef.current = requestAnimationFrame(() => {
                    pendingUpdateRef.current = false;
                    
                    setState(prev => ({
                        ...prev,
                        isListening: true,
                        currentPitch: result.detectedPitch,
                        currentScore: result.accuracy,
                        currentCombo: currentCombo,
                        lastHitType: lastHitType,
                        pitchHistory: [...visibleWindowRef.current],
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

        controller.on('pitch-analysis-update', handlePitchUpdate);
        controller.on('mic-started', handleMicStarted);
        controller.on('mic-stopped', handleMicStopped);

        return () => {
            controller.off('pitch-analysis-update', handlePitchUpdate);
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
