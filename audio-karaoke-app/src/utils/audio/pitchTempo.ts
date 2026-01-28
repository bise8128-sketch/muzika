/**
 * Pitch and Tempo Control using SoundTouchJS
 * Real-time audio manipulation for karaoke features
 */

import { PitchShifter } from 'soundtouchjs';
import { getAudioContext } from './audioContext';

/**
 * Apply pitch shift to audio buffer
 * @param audioBuffer - Input AudioBuffer
 * @param semitones - Pitch shift in semitones (-12 to +12)
 * @returns Modified AudioBuffer with pitch shift applied
 */
export async function applyPitchShift(
    audioBuffer: AudioBuffer,
    semitones: number
): Promise<AudioBuffer> {
    if (semitones === 0) {
        return audioBuffer; // No change needed
    }

    const clampedSemitones = Math.max(-12, Math.min(12, semitones));
    const pitchRatio = Math.pow(2, clampedSemitones / 12);

    return processSoundTouch(audioBuffer, pitchRatio, 1.0);
}

/**
 * Apply tempo change to audio buffer
 * @param audioBuffer - Input AudioBuffer
 * @param tempoRate - Tempo rate (0.5 to 2.0, where 1.0 is original tempo)
 * @returns Modified AudioBuffer with tempo change applied
 */
export async function applyTempoChange(
    audioBuffer: AudioBuffer,
    tempoRate: number
): Promise<AudioBuffer> {
    if (tempoRate === 1.0) {
        return audioBuffer; // No change needed
    }

    const clampedRate = Math.max(0.5, Math.min(2.0, tempoRate));

    return processSoundTouch(audioBuffer, 1.0, clampedRate);
}

/**
 * Apply both pitch and tempo changes
 * @param audioBuffer - Input AudioBuffer
 * @param semitones - Pitch shift in semitones
 * @param tempoRate - Tempo rate
 * @returns Modified AudioBuffer
 */
export async function applyPitchAndTempo(
    audioBuffer: AudioBuffer,
    semitones: number,
    tempoRate: number
): Promise<AudioBuffer> {
    if (semitones === 0 && tempoRate === 1.0) {
        return audioBuffer;
    }

    const clampedSemitones = Math.max(-12, Math.min(12, semitones));
    const pitchRatio = Math.pow(2, clampedSemitones / 12);
    const clampedRate = Math.max(0.5, Math.min(2.0, tempoRate));

    return processSoundTouch(audioBuffer, pitchRatio, clampedRate);
}

/**
 * Process audio through SoundTouch
 * @param audioBuffer - Input AudioBuffer
 * @param pitchRatio - Pitch ratio (1.0 = no change)
 * @param tempoRate - Tempo rate (1.0 = no change)
 * @returns Processed AudioBuffer
 */
async function processSoundTouch(
    audioBuffer: AudioBuffer,
    pitchRatio: number,
    tempoRate: number
): Promise<AudioBuffer> {
    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;

    // Process each channel separately
    const processedChannels: Float32Array[] = [];

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);

        // Create PitchShifter instance
        const shifter = new PitchShifter(
            sampleRate,
            channelData.length,
            1 // Single channel
        );

        // Set pitch and tempo
        shifter.pitch = pitchRatio;
        shifter.tempo = tempoRate;

        // Process audio in chunks
        const chunkSize = 4096;
        const outputSamples: number[] = [];

        for (let i = 0; i < channelData.length; i += chunkSize) {
            const chunk = channelData.slice(i, Math.min(i + chunkSize, channelData.length));
            const processed = shifter.process(chunk);

            if (processed) {
                outputSamples.push(...processed);
            }
        }

        // Flush remaining samples
        const flushed = shifter.flush();
        if (flushed) {
            outputSamples.push(...flushed);
        }

        processedChannels.push(new Float32Array(outputSamples));
    }

    // Create output AudioBuffer
    const maxLength = Math.max(...processedChannels.map(c => c.length));
    const audioContext = getAudioContext();
    const outputBuffer = audioContext.createBuffer(numberOfChannels, maxLength, sampleRate);

    // Copy processed data to output buffer
    for (let channel = 0; channel < numberOfChannels; channel++) {
        const outputData = outputBuffer.getChannelData(channel);
        const processedData = processedChannels[channel];
        outputData.set(processedData);
    }

    return outputBuffer;
}

/**
 * Real-time pitch/tempo processor for streaming audio
 */
/**
 * Real-time pitch/tempo processor for streaming audio
 * Supports stereo processing using two synchronized shifters
 */
export class RealtimeAudioProcessor {
    private leftShifter: PitchShifter | null;
    private rightShifter: PitchShifter | null;
    private sampleRate: number;

    constructor(sampleRate: number = 44100) {
        this.sampleRate = sampleRate;
        // detailed constructor: sampleRate, bufferSize, distinct channels (not used effectively in JS port generally, so we use 1 per shifter)
        try {
            this.leftShifter = new PitchShifter(sampleRate, 4096, 1);
            this.rightShifter = new PitchShifter(sampleRate, 4096, 1);
        } catch (error) {
            console.warn('PitchShifter not available, pitch shifting disabled:', error);
            this.leftShifter = null;
            this.rightShifter = null;
        }
    }

    /**
     * Set pitch shift in semitones
     */
    setPitchSemitones(semitones: number): void {
        if (!this.leftShifter || !this.rightShifter) return;
        const clampedSemitones = Math.max(-12, Math.min(12, semitones));
        const pitch = Math.pow(2, clampedSemitones / 12);
        this.leftShifter.pitch = pitch;
        this.rightShifter.pitch = pitch;
    }

    /**
     * Set tempo rate
     */
    setTempo(rate: number): void {
        if (!this.leftShifter || !this.rightShifter) return;
        const clampedRate = Math.max(0.5, Math.min(2.0, rate));
        this.leftShifter.tempo = clampedRate;
        this.rightShifter.tempo = clampedRate;
    }

    /**
     * Process audio chunk (Stereo)
     * @param leftInput - Left channel input samples
     * @param rightInput - Right channel input samples
     * @returns Object containing left and right processed samples, or null if not enough data
     */
    process(leftInput: Float32Array, rightInput: Float32Array): { left: Float32Array, right: Float32Array } | null {
        if (!this.leftShifter || !this.rightShifter) {
            // No pitch shifting, return input as output
            return { left: leftInput, right: rightInput };
        }
        // Feed data
        const leftOut = this.leftShifter.process(leftInput);
        const rightOut = this.rightShifter.process(rightInput);

        // SoundTouch buffers output. We might get nothing back until enough input accumulates.
        // We assume both channels produce same amount of output since they have same settings and input size.
        if (leftOut && rightOut && leftOut.length > 0) {
            return {
                left: new Float32Array(leftOut),
                right: new Float32Array(rightOut)
            };
        }

        return null;
    }

    /**
     * Flush remaining samples
     */
    flush(): { left: Float32Array, right: Float32Array } | null {
        if (!this.leftShifter || !this.rightShifter) {
            return null;
        }
        const leftOut = this.leftShifter.flush();
        const rightOut = this.rightShifter.flush();

        if (leftOut && rightOut && leftOut.length > 0) {
            return {
                left: new Float32Array(leftOut),
                right: new Float32Array(rightOut)
            };
        }
        return null;
    }

    /**
     * Reset processor state
     */
    reset(): void {
        try {
            this.leftShifter = new PitchShifter(this.sampleRate, 4096, 1);
            this.rightShifter = new PitchShifter(this.sampleRate, 4096, 1);
        } catch (error) {
            console.warn('PitchShifter not available, pitch shifting disabled:', error);
            this.leftShifter = null;
            this.rightShifter = null;
        }
    }
}
