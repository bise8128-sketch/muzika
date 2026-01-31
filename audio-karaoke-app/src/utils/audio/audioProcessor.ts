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

        // Preserve all channels (interleaved)
        const segmentData = new Float32Array(segmentLength * numberOfChannels);

        for (let j = 0; j < segmentLength; j++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                segmentData[j * numberOfChannels + channel] = audioBuffer.getChannelData(channel)[startSample + j];
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
export function mergeSegments(segments: Float32Array[], sampleRate: number, returnAudioBuffer: true, channels?: number): AudioBuffer;
export function mergeSegments(segments: Float32Array[], sampleRate: number, returnAudioBuffer: false, channels?: number): Float32Array;
export function mergeSegments(segments: Float32Array[], sampleRate: number, channels?: number): Float32Array;
export function mergeSegments(
    segments: Float32Array[],
    sampleRate: number,
    arg3: boolean | number = false,
    arg4?: number
): AudioBuffer | Float32Array {
    if (segments.length === 0) {
        throw new Error('Cannot merge empty segments array');
    }

    const returnAudioBuffer = typeof arg3 === 'boolean' ? arg3 : false;
    const channels = typeof arg3 === 'number' ? arg3 : (arg4 || 2);

    // Prepare helper to return correct type
    const finish = (data: Float32Array) => {
        return returnAudioBuffer ? createAudioBufferFromFloat32(data, sampleRate, channels) : data;
    };

    if (segments.length === 1) {
        return finish(segments[0]);
    }

    const crossfadeFrames = Math.floor(CROSSFADE_DURATION * sampleRate);
    const crossfadeSamples = crossfadeFrames * channels;

    // Pre-calculate total buffer size to allocate once
    // First segment contributes full length, subsequent segments contribute (length - overlap)
    let totalLength = segments[0].length;
    for (let i = 1; i < segments.length; i++) {
        totalLength += segments[i].length - crossfadeSamples;
    }

    const merged = new Float32Array(totalLength);

    // Copy first segment entirely
    merged.set(segments[0], 0);
    let writePosition = segments[0].length;

    // Process subsequent segments
    for (let i = 1; i < segments.length; i++) {
        const segment = segments[i];

        // Move write position back to start of overlap
        writePosition -= crossfadeSamples;
        const overlapStart = writePosition;

        // Inline optimized crossfade logic
        // Blends the overlap region (tail of previous + head of current)
        // Iterates linearly over interleaved samples for better cache locality
        for (let j = 0; j < crossfadeSamples; j++) {
            // Calculate frame index from sample index (for interleaved data)
            const frameIndex = Math.floor(j / channels);
            const fadeOut = (crossfadeFrames - frameIndex) / crossfadeFrames;
            const fadeIn = frameIndex / crossfadeFrames;

            // merged[overlapStart + j] has the previous segment's tail sample
            merged[overlapStart + j] = merged[overlapStart + j] * fadeOut + segment[j] * fadeIn;
        }

        // Efficiently copy the rest of the segment using .set()
        const remaining = segment.subarray(crossfadeSamples);
        merged.set(remaining, overlapStart + crossfadeSamples);

        // Advance write position to the end of the current segment
        writePosition += crossfadeSamples + remaining.length;
    }

    return finish(merged);
}

/**
 * Apply crossfade between two audio segments
 */
export function applyCrossfade(
    target: Float32Array,
    source: Float32Array,
    position: number,
    crossfadeFrames: number,
    channels: number
): void {
    const regionSize = crossfadeFrames * channels;

    for (let f = 0; f < crossfadeFrames; f++) {
        const fadeOut = (crossfadeFrames - f) / crossfadeFrames;
        const fadeIn = f / crossfadeFrames;

        for (let c = 0; c < channels; c++) {
            const idx = f * channels + c;
            if (position + idx < target.length && idx < source.length) {
                target[position + idx] = target[position + idx] * fadeOut + source[idx] * fadeIn;
            }
        }
    }

    // Copy remaining samples
    if (source.length > regionSize) {
        const remaining = source.subarray(regionSize);
        if (position + regionSize + remaining.length <= target.length) {
            target.set(remaining, position + regionSize);
        }
    }
}

/**
 * Create AudioBuffer from Float32Array
 */
function createAudioBufferFromFloat32(data: Float32Array, sampleRate: number, channels: number = 1): AudioBuffer {
    const audioContext = getAudioContext();
    const samplesPerChannel = data.length / channels;
    const audioBuffer = audioContext.createBuffer(channels, samplesPerChannel, sampleRate);

    for (let c = 0; c < channels; c++) {
        const channelData = audioBuffer.getChannelData(c);
        for (let i = 0; i < samplesPerChannel; i++) {
            channelData[i] = data[i * channels + c];
        }
    }

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
 * Resample audio to target sample rate using OfflineAudioContext
 * This provides high-quality native resampling.
 */
export async function resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
    if (audioBuffer.sampleRate === targetSampleRate) {
        return audioBuffer;
    }

    const newLength = Math.ceil(audioBuffer.duration * targetSampleRate);
    const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        newLength,
        targetSampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    return await offlineCtx.startRendering();
}
