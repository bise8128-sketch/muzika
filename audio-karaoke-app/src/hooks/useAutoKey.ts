'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { KeyInfo } from '../utils/audio/keyDetectionCore';
import { VocalRangeType, getRecommendedShift } from '../utils/audio/vocalRange';
import { PlaybackController } from '../utils/audio/playback/PlaybackCore';
import type { KeyWorkerResponse } from '../workers/keyDetection.worker';

/**
 * useAutoKey — Detects the musical key of the loaded track off the main thread.
 *
 * Spawns a `keyDetection.worker` on mount and terminates it on unmount.
 * The heavy chromagram + Krumhansl-Kessler analysis runs in the worker,
 * keeping the 60 fps visualizers stutter-free even on mobile.
 */
export function useAutoKey(controller: PlaybackController) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [detectedKey, setDetectedKey] = useState<KeyInfo | null>(null);
    const [vocalRange, setVocalRange] = useState<VocalRangeType>('tenor');
    const [suggestedShift, setSuggestedShift] = useState<number | null>(null);

    // Persistent worker reference — created once, reused across analyses
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        // Spin up the worker
        const worker = new Worker(
            new URL('../workers/keyDetection.worker.ts', import.meta.url),
            { type: 'module' },
        );
        workerRef.current = worker;

        return () => {
            worker.terminate();
            workerRef.current = null;
        };
    }, []);

    const analyzeTrack = useCallback(async () => {
        const buffers = controller.getAudioBuffers();
        if (buffers.length === 0 || !workerRef.current) return;

        setIsAnalyzing(true);

        const buffer = buffers[0];
        const sampleRate = buffer.sampleRate;

        // getChannelData returns a *view* — we copy it so we can safely transfer ownership.
        const channelData = buffer.getChannelData(0).slice(); // copy

        const worker = workerRef.current;

        const handleMessage = (e: MessageEvent<KeyWorkerResponse>) => {
            const { type, payload } = e.data;

            if (type === 'KEY_RESULT') {
                const key = payload as KeyInfo;
                setDetectedKey(key);
                setSuggestedShift(getRecommendedShift(key, vocalRange));
                setIsAnalyzing(false);
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);
            }
        };

        const handleError = (e: ErrorEvent) => {
            console.error('[useAutoKey] Worker error:', e.message);
            setIsAnalyzing(false);
            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
        };

        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);

        // Transfer the Float32Array buffer (zero-copy) to the worker
        worker.postMessage(
            { type: 'ANALYZE_KEY', payload: { channelData, sampleRate } },
            [channelData.buffer],
        );
    }, [controller, vocalRange]);

    const applyShift = useCallback(() => {
        if (suggestedShift !== null) {
            controller.setPitch(suggestedShift);
        }
    }, [controller, suggestedShift]);

    const updateVocalRange = useCallback((range: VocalRangeType) => {
        setVocalRange(range);
        if (detectedKey) {
            setSuggestedShift(getRecommendedShift(detectedKey, range));
        }
    }, [detectedKey]);

    return {
        isAnalyzing,
        detectedKey,
        vocalRange,
        suggestedShift,
        analyzeTrack,
        applyShift,
        updateVocalRange,
    };
}
