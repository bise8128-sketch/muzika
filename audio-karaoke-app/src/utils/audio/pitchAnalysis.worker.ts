/**
 * Pitch Analysis Worker
 * 
 * Pre-calculates the pitch curve for the entire vocal track to enable
 * the "Note Highway" visualization (showing future notes).
 * 
 * Runs off the main thread to avoid freezing the UI during analysis.
 */

import { PitchCorrector } from './pitchCorrection';

export interface PitchAnalysisMessage {
    type: 'ANALYZE_BUFFER';
    payload: {
        buffer: Float32Array;
        sampleRate: number;
    };
}

export interface PitchAnalysisResponse {
    type: 'PITCH_MAP_READY' | 'ERROR';
    payload: {
        pitchMap?: { timestamp: number; pitch: number; midi: number }[];
        error?: string;
    };
}

const WINDOW_SIZE = 2048; // ~46ms at 44.1kHz
const HOP_SIZE = 1024;    // 50% overlap

self.onmessage = (e: MessageEvent<PitchAnalysisMessage>) => {
    const { type, payload } = e.data;

    if (type === 'ANALYZE_BUFFER') {
        try {
            const { buffer, sampleRate } = payload;
            const pitchMap: { timestamp: number; pitch: number; midi: number }[] = [];
            
            // Analyze the buffer in windows
            for (let i = 0; i < buffer.length - WINDOW_SIZE; i += HOP_SIZE) {
                const window = buffer.slice(i, i + WINDOW_SIZE);
                const result = PitchCorrector.detectPitch(window, sampleRate);
                
                if (result && result.confidence > 0.7) { // Only high confidence for reference
                    const timestamp = i / sampleRate;
                    pitchMap.push({
                        timestamp,
                        pitch: result.frequency,
                        midi: result.midiNote
                    });
                }
            }

            self.postMessage({
                type: 'PITCH_MAP_READY',
                payload: { pitchMap }
            });

        } catch (err) {
            self.postMessage({
                type: 'ERROR',
                payload: { error: err instanceof Error ? err.message : String(err) }
            });
        }
    }
};
