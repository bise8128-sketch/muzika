/**
 * Audio processing utilities
 * Handles audio segmentation, crossfading, and buffer manipulation
 */

import { getAudioContext } from './audioContext';
import type { AudioSegment } from '@/types/audio';

/**
 * Default segment duration in seconds
 */
const DEFAULT_SEGMENT_DURATION = 30;

/**
 * Crossfade duration in seconds
 */
const CROSSFADE_DURATION = 0.5;

/**
 * Segment audio into chunks for processing
 * @param audioBuffer - Input AudioBuffer
 * @param segmentDuration - Duration of each segment in seconds (default: 30s)
 * @returns Array of audio segments
 */
export interface SimpleAudioBuffer {
    sampleRate: number;
    numberOfChannels: number;
    length: number;
    duration: number;
    getChannelData(channel: number): Float32Array;
}

/**
 * Segment audio into chunks for processing
 * @param audioBuffer - Input AudioBuffer or compatible interface
 * @param segmentDuration - Duration of each segment in seconds (default: 30s)
 * @returns Array of audio segments
 */
export function segmentAudio(
    audioBuffer: SimpleAudioBuffer | AudioBuffer,
    segmentDuration: number = DEFAULT_SEGMENT_DURATION
): AudioSegment[] {
    const sampleRate = audioBuffer.sampleRate;
    const totalDuration = audioBuffer.duration;
    const segmentSamples = Math.floor(segmentDuration * sampleRate);
    const overlapSamples = Math.floor(CROSSFADE_DURATION * sampleRate);

    const segments: AudioSegment[] = [];
    const numberOfChannels = audioBuffer.numberOfChannels;

    // Calculate number of segments
    const numSegments = Math.ceil(totalDuration / segmentDuration);

    for (let i = 0; i < numSegments; i++) {
        const startSample = i * segmentSamples;
        const endSample = Math.min((i + 1) * segmentSamples + overlapSamples, audioBuffer.length);
        const segmentLength = endSample - startSample;

        // Mix channels to mono for processing
        const segmentData = new Float32Array(segmentLength);

        for (let channel = 0; channel < numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let j = 0; j < segmentLength; j++) {
                segmentData[j] += channelData[startSample + j] / numberOfChannels;
            }
        }

        segments.push({
            data: segmentData,
            startTime: i * segmentDuration,
            endTime: Math.min((i + 1) * segmentDuration, totalDuration),
            sampleRate,
        });
    }

    return segments;
}

/**
 * Merge audio segments back into a single buffer with crossfading
 * @param segments - Array of processed segments
 * @param sampleRate - Sample rate
 * @returns Merged AudioBuffer
 */
export function mergeSegments(segments: Float32Array[], sampleRate: number, returnAudioBuffer: true): AudioBuffer;
export function mergeSegments(segments: Float32Array[], sampleRate: number, returnAudioBuffer: false): Float32Array;
export function mergeSegments(segments: Float32Array[], sampleRate: number): Float32Array;
export function mergeSegments(segments: Float32Array[], sampleRate: number, returnAudioBuffer: boolean = false): AudioBuffer | Float32Array {
    if (segments.length === 0) {
        throw new Error('Cannot merge empty segments array');
    }

    // Prepare helper to return correct type
    const finish = (data: Float32Array) => {
        return returnAudioBuffer ? createAudioBufferFromFloat32(data, sampleRate) : data;
    };

    if (segments.length === 1) {
        // Single segment, no need to merge
        return finish(segments[0]);
    }

    const crossfadeSamples = Math.floor(CROSSFADE_DURATION * sampleRate);

    // Calculate total length
    let totalLength = 0;
    segments.forEach((segment, index) => {
        if (index === segments.length - 1) {
            totalLength += segment.length;
        } else {
            totalLength += segment.length - crossfadeSamples;
        }
    });

    const merged = new Float32Array(totalLength);
    let writePosition = 0;

    segments.forEach((segment, index) => {
        if (index === 0) {
            // First segment - copy entirely
            merged.set(segment, writePosition);
            writePosition += segment.length - crossfadeSamples;
        } else if (index === segments.length - 1) {
            // Last segment - crossfade with previous
            applyCrossfade(merged, segment, writePosition, crossfadeSamples);
            writePosition += segment.length;
        } else {
            // Middle segments - crossfade
            applyCrossfade(merged, segment, writePosition, crossfadeSamples);
            writePosition += segment.length - crossfadeSamples;
        }
    });

    return finish(merged);
}

/**
 * Apply crossfade between two audio segments
 */
function applyCrossfade(
    target: Float32Array,
    source: Float32Array,
    position: number,
    crossfadeSamples: number
): void {
    // Crossfade region
    for (let i = 0; i < crossfadeSamples && i < source.length; i++) {
        const fadeOut = (crossfadeSamples - i) / crossfadeSamples;
        const fadeIn = i / crossfadeSamples;
        target[position + i] = target[position + i] * fadeOut + source[i] * fadeIn;
    }

    // Copy remaining samples
    const remaining = source.subarray(crossfadeSamples);
    target.set(remaining, position + crossfadeSamples);
}

/**
 * Create AudioBuffer from Float32Array
 */
function createAudioBufferFromFloat32(data: Float32Array, sampleRate: number): AudioBuffer {
    const audioContext = getAudioContext();
    const audioBuffer = audioContext.createBuffer(1, data.length, sampleRate);
    audioBuffer.getChannelData(0).set(data);
    return audioBuffer;
}

/**
 * Normalize audio to prevent clipping
 * @param data - Audio data
 * @returns Normalized audio data
 */
export function normalizeAudio(data: Float32Array): Float32Array {
    let max = 0;

    for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > max) max = abs;
    }

    if (max === 0) return data;

    const normalized = new Float32Array(data.length);
    const scale = 1.0 / max;

    for (let i = 0; i < data.length; i++) {
        normalized[i] = data[i] * scale;
    }

    return normalized;
}

/**
 * Convert stereo AudioBuffer to mono
 */
export function stereoToMono(audioBuffer: AudioBuffer): AudioBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;

    if (numberOfChannels === 1) {
        return audioBuffer; // Already mono
    }

    const audioContext = getAudioContext();
    const monoBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
    const monoData = monoBuffer.getChannelData(0);

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < audioBuffer.length; i++) {
            monoData[i] += channelData[i] / numberOfChannels;
        }
    }

    return monoBuffer;
}

/**
 * Resample audio to target sample rate
 * Note: This is a simple linear interpolation. For production, consider using a proper resampler.
 */
export function resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): AudioBuffer {
    if (audioBuffer.sampleRate === targetSampleRate) {
        return audioBuffer;
    }

    const audioContext = getAudioContext();
    const ratio = targetSampleRate / audioBuffer.sampleRate;
    const newLength = Math.floor(audioBuffer.length * ratio);
    const numberOfChannels = audioBuffer.numberOfChannels;

    const resampled = audioContext.createBuffer(numberOfChannels, newLength, targetSampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const outputData = resampled.getChannelData(channel);

        for (let i = 0; i < newLength; i++) {
            const srcIndex = i / ratio;
            const srcIndexFloor = Math.floor(srcIndex);
            const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
            const fraction = srcIndex - srcIndexFloor;

            // Linear interpolation
            outputData[i] = inputData[srcIndexFloor] * (1 - fraction) + inputData[srcIndexCeil] * fraction;
        }
    }

    return resampled;
}
