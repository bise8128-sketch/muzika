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
import {
    analyzeDetectedPitch,
    getReferencePitchAtTime,
    getPerformanceScore,
} from '@/utils/audio/pitchAnalysis';

const ANALYSIS_BUFFER_SIZE = 4096;

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

    const micStreamRef = useRef<MediaStream | null>(null);
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const pitchDetectorRef = useRef<AudioWorkletNode | null>(null);
    const historyRef = useRef<PitchAnalysisResult[]>([]);
    const comboRef = useRef<number>(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const pendingUpdateRef = useRef<boolean>(false);

    const cleanup = useCallback(() => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (pitchDetectorRef.current) {
            pitchDetectorRef.current.port.close();
            pitchDetectorRef.current.disconnect();
            pitchDetectorRef.current = null;
        }
        micSourceRef.current?.disconnect();
        micStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
        micSourceRef.current = null;
    }, []);

    // Start analysis
    const startAnalysis = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            micStreamRef.current = stream;

            // Create audio context for mic analysis
            const ctx = new AudioContext();
            audioContextRef.current = ctx;

            // Load the worklet
            await ctx.audioWorklet.addModule(new URL('@/utils/audio/pitchDetector.worklet.ts', import.meta.url));

            const source = ctx.createMediaStreamSource(stream);
            const pitchDetector = new AudioWorkletNode(ctx, 'pitch-detector', {
                processorOptions: { sampleRate: ctx.sampleRate }
            });

            source.connect(pitchDetector);
            // Connect dummy output to keep worklet alive
            const silence = ctx.createGain();
            silence.gain.value = 0;
            pitchDetector.connect(silence);
            silence.connect(ctx.destination);

            micSourceRef.current = source;
            pitchDetectorRef.current = pitchDetector;
            historyRef.current = [];

            setState(prev => ({
                ...prev,
                isListening: true,
                error: null,
                pitchHistory: [],
                overallScore: null,
            }));

            // Get vocal buffer for reference
            const buffers = controller.getAudioBuffers();
            const vocalBuffer = buffers[0] || null; // First buffer is typically vocals

            pitchDetector.port.onmessage = (event) => {
                if (event.data.type === 'pitch_data') {
                    const { frequency, confidence } = event.data;
                    const currentTime = controller.getCurrentTime();

                    const refPitch = vocalBuffer
                        ? getReferencePitchAtTime(vocalBuffer, currentTime, ANALYSIS_BUFFER_SIZE)
                        : null;

                    const result = analyzeDetectedPitch(
                        frequency,
                        confidence,
                        refPitch,
                        currentTime,
                        keyInfo
                    );

                    if (result) {
                        historyRef.current.push(result);

                        // Combo Logic
                        const isHit = result.accuracy >= 70 || (result.harmonyInterval !== null && result.harmonyAccuracy >= 60);
                        if (isHit) {
                            comboRef.current++;
                        } else if (result.referencePitch > 0) {
                            // Only reset combo if there was a reference but we missed it
                            // (silence doesn't break combo if it's natural)
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

                        // Throttle state update to requestAnimationFrame
                        if (!pendingUpdateRef.current) {
                            pendingUpdateRef.current = true;
                            animationFrameRef.current = requestAnimationFrame(() => {
                                pendingUpdateRef.current = false;
                                
                                // Optimization: Only pass the last 300 points for real-time visualization
                                // This prevents massive array cloning (60fps x 10k items)
                                const visibleWindow = historyRef.current.slice(-300);
                                const latestResult = visibleWindow[visibleWindow.length - 1];
                                
                                setState(prev => ({
                                    ...prev,
                                    currentPitch: latestResult.detectedPitch,
                                    currentScore: latestResult.accuracy,
                                    currentCombo: comboRef.current,
                                    lastHitType: hitType,
                                    pitchHistory: visibleWindow, // Only the sliding window
                                }));
                            });
                        }
                    }
                }
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Microphone access denied';
            setState(prev => ({ ...prev, error: message }));
        }
    }, [controller, keyInfo]);

    // Stop analysis
    const stopAnalysis = useCallback(() => {
        cleanup();

        const score = getPerformanceScore(historyRef.current);

        setState(prev => ({
            ...prev,
            isListening: false,
            overallScore: score,
            pitchHistory: [...historyRef.current] // Final full history for the results page
        }));
    }, [cleanup]);

    // Reset
    const resetAnalysis = useCallback(() => {
        cleanup();
        historyRef.current = [];
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
    }, [cleanup]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
            audioContextRef.current?.close();
        };
    }, [cleanup]);

    return {
        ...state,
        startAnalysis,
        stopAnalysis,
        resetAnalysis,
    };
}
