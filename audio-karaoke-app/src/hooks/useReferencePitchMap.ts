import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';

export interface PitchPoint {
    timestamp: number;
    pitch: number;
    midi: number;
}

export function useReferencePitchMap(controller: PlaybackController | null) {
    const [pitchMap, setPitchMap] = useState<PitchPoint[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const workerRef = useRef<Worker | null>(null);
    const analyzedBufferRef = useRef<AudioBuffer | null>(null);

    const analyzeBuffer = useCallback((buffer: AudioBuffer) => {
        if (workerRef.current) workerRef.current.terminate();

        setIsAnalyzing(true);
        // Create worker using relative path
        workerRef.current = new Worker(new URL('../utils/audio/pitchAnalysis.worker.ts', import.meta.url));

        workerRef.current.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'PITCH_MAP_READY') {
                setPitchMap(payload.pitchMap);
                setIsAnalyzing(false);
            } else if (type === 'ERROR') {
                console.error('Pitch Analysis Worker Error:', payload.error);
                setIsAnalyzing(false);
            }
        };

        const channelData = buffer.getChannelData(0);
        
        workerRef.current.postMessage({
            type: 'ANALYZE_BUFFER',
            payload: {
                buffer: channelData,
                sampleRate: buffer.sampleRate
            }
        });
    }, []);

    useEffect(() => {
        if (!controller) return;

        const checkAndAnalyze = () => {
            const buffers = controller.getAudioBuffers();
            const vocalBuffer = buffers[0]; 

            if (vocalBuffer && vocalBuffer !== analyzedBufferRef.current) {
                analyzedBufferRef.current = vocalBuffer;
                analyzeBuffer(vocalBuffer);
            }
        };

        checkAndAnalyze();
        
        // Listen for buffer updates if possible, or just rely on re-renders
        // Since controller.getAudioBuffers() is mutable, we rely on parent causing re-render 
        // when buffers change (e.g. separation completes)
        
    }, [controller, analyzeBuffer]);

    useEffect(() => {
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, []);

    return { pitchMap, isAnalyzing };
}
