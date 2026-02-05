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
 * Supports stereo processing using AudioWorklet (modern) or fallback to passthrough
 */
export class RealtimeAudioProcessor {
    private audioContext: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private sampleRate: number;
    private isWorkletSupported: boolean = false;
    private isInitialized: boolean = false;

    constructor(sampleRate: number = 44100) {
        this.sampleRate = sampleRate;

        // Check if AudioWorklet is supported
        if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
            this.isWorkletSupported = 'audioWorklet' in AudioContext.prototype;
        }

        if (!this.isWorkletSupported) {
            console.warn('AudioWorklet not supported, pitch/tempo features will be disabled');
        }
    }

    /**
     * Initialize the AudioWorklet
     * Must be called in a user interaction context due to AudioContext restrictions
     */
    async initialize(audioContext: AudioContext): Promise<void> {
        if (this.isInitialized || !this.isWorkletSupported) {
            return;
        }

        this.audioContext = audioContext;

        try {
            // Load the AudioWorklet module
            await audioContext.audioWorklet.addModule('/audio/pitch-tempo.worklet.js');

            // Create the worklet node
            this.workletNode = new AudioWorkletNode(audioContext, 'pitch-tempo-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [2], // Stereo
            });

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize AudioWorklet:', error);
            this.isWorkletSupported = false;
        }
    }

    /**
     * Get the worklet node for connecting to audio graph
     */
    getNode(): AudioWorkletNode | null {
        return this.workletNode;
    }

    /**
     * Check if processor is available and initialized
     */
    isAvailable(): boolean {
        return this.isWorkletSupported && this.isInitialized;
    }

    /**
     * Set pitch shift in semitones
     */
    setPitchSemitones(semitones: number): void {
        if (!this.workletNode) return;
        const clampedSemitones = Math.max(-12, Math.min(12, semitones));
        const pitch = Math.pow(2, clampedSemitones / 12);
        this.workletNode.port.postMessage({ type: 'setPitch', value: pitch });
    }

    /**
     * Set tempo rate
     */
    setTempo(rate: number): void {
        if (!this.workletNode) return;
        const clampedRate = Math.max(0.5, Math.min(2.0, rate));
        this.workletNode.port.postMessage({ type: 'setTempo', value: clampedRate });
    }

    /**
     * Process audio chunk (Stereo) - DEPRECATED for AudioWorklet
     * This method is kept for backward compatibility but does nothing
     * Audio processing happens in the worklet node automatically
     */
    process(leftInput: Float32Array, rightInput: Float32Array): { left: Float32Array, right: Float32Array } | null {
        // For AudioWorklet, processing happens automatically in the audio graph
        // This is a compatibility shim for the old ScriptProcessor-based code
        // Return the input unchanged (passthrough)
        return { left: leftInput, right: rightInput };
    }

    /**
     * Flush remaining samples - DEPRECATED for AudioWorklet
     */
    flush(): { left: Float32Array, right: Float32Array } | null {
        return null;
    }

    /**
     * Reset processor state
     */
    reset(): void {
        if (!this.workletNode) return;
        this.workletNode.port.postMessage({ type: 'reset' });
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        this.isInitialized = false;
    }
}
