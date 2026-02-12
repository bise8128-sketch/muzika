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
import {
    analyzeFrame,
    getReferencePitchAtTime,
    getPerformanceScore,
} from '@/utils/audio/pitchAnalysis';

const ANALYSIS_BUFFER_SIZE = 4096;

interface PitchAnalysisState {
    isListening: boolean;
    currentPitch: number;          // Hz
    currentScore: number;          // 0–100
    overallScore: PerformanceScore | null;
    pitchHistory: PitchAnalysisResult[];
    error: string | null;
}

export function usePitchAnalysis(controller: PlaybackController) {
    const [state, setState] = useState<PitchAnalysisState>({
        isListening: false,
        currentPitch: 0,
        currentScore: 0,
        overallScore: null,
        pitchHistory: [],
        error: null,
    });

    const micStreamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const rafRef = useRef<number>(0);
    const historyRef = useRef<PitchAnalysisResult[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Cleanup helper
    const cleanup = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = 0;
        }
        micSourceRef.current?.disconnect();
        micStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
        analyserRef.current = null;
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

            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = ANALYSIS_BUFFER_SIZE * 2;
            source.connect(analyser);

            micSourceRef.current = source;
            analyserRef.current = analyser;
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

            // Analysis loop
            const buffer = new Float32Array(ANALYSIS_BUFFER_SIZE);
            const tick = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getFloatTimeDomainData(buffer);

                const currentTime = controller.getCurrentTime();

                // Get reference pitch at the current playback time
                const refPitch = vocalBuffer
                    ? getReferencePitchAtTime(vocalBuffer, currentTime, ANALYSIS_BUFFER_SIZE)
                    : null;

                const result = analyzeFrame(
                    buffer,
                    refPitch,
                    audioContextRef.current?.sampleRate ?? 44100,
                    currentTime,
                );

                if (result) {
                    historyRef.current.push(result);

                    setState(prev => ({
                        ...prev,
                        currentPitch: result.detectedPitch,
                        currentScore: result.accuracy,
                        pitchHistory: [...historyRef.current],
                    }));
                }

                rafRef.current = requestAnimationFrame(tick);
            };

            rafRef.current = requestAnimationFrame(tick);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Microphone access denied';
            setState(prev => ({ ...prev, error: message }));
        }
    }, [controller]);

    // Stop analysis
    const stopAnalysis = useCallback(() => {
        cleanup();

        const score = getPerformanceScore(historyRef.current);

        setState(prev => ({
            ...prev,
            isListening: false,
            overallScore: score,
        }));
    }, [cleanup]);

    // Reset
    const resetAnalysis = useCallback(() => {
        cleanup();
        historyRef.current = [];
        setState({
            isListening: false,
            currentPitch: 0,
            currentScore: 0,
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
