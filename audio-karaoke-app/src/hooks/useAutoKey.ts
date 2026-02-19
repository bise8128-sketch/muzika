'use client';

import { useState, useCallback } from 'react';
import { KeyDetector, KeyInfo } from '../utils/audio/keyDetection';
import { VocalRangeType, getRecommendedShift } from '../utils/audio/vocalRange';
import { PlaybackController } from '../utils/audio/playback/PlaybackCore';

export function useAutoKey(controller: PlaybackController) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [detectedKey, setDetectedKey] = useState<KeyInfo | null>(null);
    const [vocalRange, setVocalRange] = useState<VocalRangeType>('tenor');
    const [suggestedShift, setSuggestedShift] = useState<number | null>(null);

    const analyzeTrack = useCallback(async () => {
        const buffers = controller.getAudioBuffers();
        if (buffers.length === 0) return;

        setIsAnalyzing(true);
        
        // Use a slight timeout to allow UI to show loading state if it's very fast
        setTimeout(() => {
            try {
                // Analyze the first buffer (usually vocals or full mix)
                const key = KeyDetector.analyzeKey(buffers[0]);
                setDetectedKey(key);
                
                const shift = getRecommendedShift(key, vocalRange);
                setSuggestedShift(shift);
            } catch (error) {
                console.error('Key detection failed:', error);
            } finally {
                setIsAnalyzing(false);
            }
        }, 100);
    }, [controller, vocalRange]);

    const applyShift = useCallback(() => {
        if (suggestedShift !== null) {
            controller.setPitch(suggestedShift);
        }
    }, [controller, suggestedShift]);

    const updateVocalRange = useCallback((range: VocalRangeType) => {
        setVocalRange(range);
        if (detectedKey) {
            const shift = getRecommendedShift(detectedKey, range);
            setSuggestedShift(shift);
        }
    }, [detectedKey]);

    return {
        isAnalyzing,
        detectedKey,
        vocalRange,
        suggestedShift,
        analyzeTrack,
        applyShift,
        updateVocalRange
    };
}
