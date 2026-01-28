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
export class RealtimeAudioProcessor {
    private shifter: PitchShifter;
    private sampleRate: number;

    constructor(sampleRate: number = 44100) {
        this.sampleRate = sampleRate;
        this.shifter = new PitchShifter(sampleRate, 4096, 1);
    }

    /**
     * Set pitch shift in semitones
     */
    setPitchSemitones(semitones: number): void {
        const clampedSemitones = Math.max(-12, Math.min(12, semitones));
        this.shifter.pitch = Math.pow(2, clampedSemitones / 12);
    }

    /**
     * Set tempo rate
     */
    setTempo(rate: number): void {
        const clampedRate = Math.max(0.5, Math.min(2.0, rate));
        this.shifter.tempo = clampedRate;
    }

    /**
     * Process audio chunk
     */
    process(input: Float32Array): Float32Array | null {
        const output = this.shifter.process(input);
        return output ? new Float32Array(output) : null;
    }

    /**
     * Flush remaining samples
     */
    flush(): Float32Array | null {
        const output = this.shifter.flush();
        return output ? new Float32Array(output) : null;
    }

    /**
     * Reset processor state
     */
    reset(): void {
        this.shifter = new PitchShifter(this.sampleRate, 4096, 1);
    }
}
