/**
 * AudioBuffer utility functions that require a DOM/AudioContext environment.
 * These are NOT safe to use in Web Workers.
 */

import { getAudioContext } from './audioContext';

/**
 * Create AudioBuffer from Float32Array
 */
export function createAudioBufferFromFloat32(data: Float32Array, sampleRate: number, channels: number = 1): AudioBuffer {
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
 * Resample audio to target sample rate using OfflineAudioContext
 */
export async function resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
    if (audioBuffer.sampleRate === targetSampleRate) {
        return audioBuffer;
    }

    if (typeof OfflineAudioContext === 'undefined') {
        throw new Error('OfflineAudioContext not supported in this environment');
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

/**
 * Merge audio segments back into a single AudioBuffer
 */
export function mergeSegmentsToAudioBuffer(
    segments: Float32Array[],
    sampleRate: number,
    channels: number = 2,
    mergeLogic: (segments: Float32Array[], sampleRate: number, channels: number) => Float32Array
): AudioBuffer {
    const mergedData = mergeLogic(segments, sampleRate, channels);
    return createAudioBufferFromFloat32(mergedData, sampleRate, channels);
}
