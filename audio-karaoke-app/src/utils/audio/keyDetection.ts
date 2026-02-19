/**
 * KeyDetector - Chromagram-based key detection utility.
 * 
 * Analyzes audio buffers to determine the most likely musical key
 * using Krumhansl-Kessler key profiles.
 */

import { PitchCorrector } from './pitchCorrection';

export interface KeyInfo {
    tonic: string;
    scale: 'major' | 'minor';
    confidence: number;
}

export class KeyDetector {
    private static readonly NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Krumhansl-Kessler Key Profiles
    private static readonly PROFILES = {
        major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
        minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    };

    /**
     * Detect the key of an audio buffer.
     * Takes a sample of the buffer to build a chroma profile.
     */
    static analyzeKey(buffer: AudioBuffer): KeyInfo {
        const sampleRate = buffer.sampleRate;
        const channelData = buffer.getChannelData(0);
        const duration = buffer.duration;
        const numSamples = 20; // Number of spots to sample
        const windowSize = 4096;
        
        const chroma = new Float32Array(12).fill(0);

        for (let i = 0; i < numSamples; i++) {
            const time = (duration / (numSamples + 1)) * (i + 1);
            const start = Math.floor(time * sampleRate);
            if (start + windowSize > channelData.length) break;

            const window = channelData.slice(start, start + windowSize);
            const result = PitchCorrector.detectPitch(window, sampleRate);

            if (result && result.confidence > 0.4) {
                const midi = Math.round(result.midiNote);
                const noteIndex = midi % 12;
                chroma[noteIndex] += result.confidence;
            }
        }

        // Normalize chroma
        const maxChroma = Math.max(...chroma);
        if (maxChroma === 0) {
            return { tonic: 'C', scale: 'major', confidence: 0 };
        }
        for (let i = 0; i < 12; i++) chroma[i] /= maxChroma;

        let bestKey = { tonic: 'C', scale: 'major' as const, correlation: -1 };

        for (const scale of ['major', 'minor'] as const) {
            const profile = this.PROFILES[scale];
            for (let root = 0; root < 12; root++) {
                const correlation = this.calculateCorrelation(chroma, profile, root);
                if (correlation > bestKey.correlation) {
                    bestKey = { tonic: this.NOTE_NAMES[root], scale: scale as 'major' | 'minor', correlation };
                }
            }
        }

        return {
            tonic: bestKey.tonic,
            scale: bestKey.scale,
            confidence: Math.max(0, bestKey.correlation)
        };
    }

    private static calculateCorrelation(chroma: Float32Array, profile: number[], shift: number): number {
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        const n = 12;

        for (let i = 0; i < n; i++) {
            const x = chroma[(i + shift) % 12];
            const y = profile[i];
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
            sumY2 += y * y;
        }

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        return denominator === 0 ? 0 : numerator / denominator;
    }
}
