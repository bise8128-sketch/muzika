/**
 * keyDetectionCore — Pure, Worker-safe key detection logic.
 *
 * No browser API dependencies (no AudioBuffer, no AudioContext, no performance).
 * All functions accept plain Float32Array + sampleRate so they can be
 * imported in both the main thread and a Web Worker.
 */

export interface KeyInfo {
    tonic: string;
    scale: 'major' | 'minor';
    confidence: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Kessler Key Profiles
const KK_PROFILES = {
    major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
};

// ─────────────────────────────────────────────────────────────────────────────
// Pitch detection (autocorrelation)
// ─────────────────────────────────────────────────────────────────────────────

interface PitchResult {
    midiNote: number;
    confidence: number;
}

/**
 * Autocorrelation-based pitch detector.
 * Returns null when confidence is below threshold (< 0.3).
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): PitchResult | null {
    const bufferSize = buffer.length;
    const minPeriod = Math.floor(sampleRate / 1200); // ~1200 Hz ceiling
    const maxPeriod = Math.floor(sampleRate / 80);   // ~80 Hz floor

    // Energy at lag 0
    let energy = 0;
    for (let i = 0; i < bufferSize; i++) energy += buffer[i] * buffer[i];

    if (energy < 1e-8) return null; // Silence

    // Autocorrelation for the lag range of interest
    const autocorr = new Float32Array(maxPeriod + 1);
    autocorr[0] = energy;
    for (let lag = minPeriod; lag <= maxPeriod; lag++) {
        let sum = 0;
        for (let i = 0; i < bufferSize - lag; i++) sum += buffer[i] * buffer[i + lag];
        autocorr[lag] = sum;
    }

    // Find peak lag
    let peakLag = minPeriod;
    let peakValue = autocorr[minPeriod];
    for (let lag = minPeriod + 1; lag <= maxPeriod; lag++) {
        if (autocorr[lag] > peakValue) {
            peakValue = autocorr[lag];
            peakLag = lag;
        }
    }

    const confidence = peakValue / (autocorr[0] + 1e-10);
    if (confidence < 0.3) return null;

    const frequency = sampleRate / peakLag;
    const midiNote = 69 + 12 * Math.log2(frequency / 440);

    return { midiNote, confidence };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chromagram builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a normalised 12-bin chroma vector from raw PCM data.
 *
 * @param channelData  Mono PCM samples (Float32Array)
 * @param sampleRate   Sample rate in Hz
 * @param numSamples   Number of evenly-spaced windows to analyse (default 20)
 * @param windowSize   Samples per window (default 4096)
 * @returns            Normalised chroma vector (Float32Array of length 12)
 */
export function buildChroma(
    channelData: Float32Array,
    sampleRate: number,
    numSamples = 20,
    windowSize = 4096,
): Float32Array {
    const totalSamples = channelData.length;
    const duration = totalSamples / sampleRate;
    const chroma = new Float32Array(12).fill(0);

    for (let i = 0; i < numSamples; i++) {
        const time = (duration / (numSamples + 1)) * (i + 1);
        const start = Math.floor(time * sampleRate);
        if (start + windowSize > totalSamples) break;

        const window = channelData.slice(start, start + windowSize);
        const result = detectPitch(window, sampleRate);

        if (result && result.confidence > 0.4) {
            const noteIndex = Math.round(result.midiNote) % 12;
            chroma[noteIndex] += result.confidence;
        }
    }

    // Normalise
    const maxChroma = Math.max(...chroma);
    if (maxChroma > 0) {
        for (let i = 0; i < 12; i++) chroma[i] /= maxChroma;
    }

    return chroma;
}

// ─────────────────────────────────────────────────────────────────────────────
// Krumhansl-Kessler correlation
// ─────────────────────────────────────────────────────────────────────────────

function pearsonCorrelation(chroma: Float32Array, profile: number[], shift: number): number {
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

/**
 * Find the best-matching key from a chroma vector using
 * Krumhansl-Kessler profiles.
 *
 * @param chroma  Normalised 12-bin chroma vector
 * @returns       KeyInfo with tonic, scale, and correlation confidence
 */
export function correlateChromaToKey(chroma: Float32Array): KeyInfo {
    const maxChroma = Math.max(...chroma);
    if (maxChroma === 0) {
        return { tonic: 'C', scale: 'major', confidence: 0 };
    }

    let bestTonic = 'C';
    let bestScale: 'major' | 'minor' = 'major';
    let bestCorrelation = -Infinity;

    for (const scale of ['major', 'minor'] as const) {
        const profile = KK_PROFILES[scale];
        for (let root = 0; root < 12; root++) {
            const correlation = pearsonCorrelation(chroma, profile, root);
            if (correlation > bestCorrelation) {
                bestTonic = NOTE_NAMES[root];
                bestScale = scale;
                bestCorrelation = correlation;
            }
        }
    }

    return {
        tonic: bestTonic,
        scale: bestScale,
        confidence: Math.max(0, bestCorrelation),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: run the full pipeline on raw PCM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full key-detection pipeline: PCM data → KeyInfo.
 * This is the function called by the Web Worker.
 */
export function analyzeKeyFromPCM(
    channelData: Float32Array,
    sampleRate: number,
): KeyInfo {
    const chroma = buildChroma(channelData, sampleRate);
    return correlateChromaToKey(chroma);
}
