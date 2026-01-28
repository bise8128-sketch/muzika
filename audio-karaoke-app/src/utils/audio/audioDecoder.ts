/**
 * Audio decoding utilities
 * Handles decoding of audio files (MP3, WAV, OGG) to AudioBuffer
 */

import { getAudioContext } from './audioContext';

/**
 * Supported audio formats
 */
export const SUPPORTED_FORMATS = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/x-wav'];

/**
 * Decode an audio file to AudioBuffer
 * @param file - Audio file to decode
 * @returns Decoded AudioBuffer
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
    // Validate file type
    if (!SUPPORTED_FORMATS.includes(file.type) && !isSupportedFileExtension(file.name)) {
        throw new Error(`Unsupported audio format: ${file.type}. Supported formats: MP3, WAV, OGG`);
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Decode using Web Audio API
    const audioContext = getAudioContext();

    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (error) {
        throw new Error(`Failed to decode audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Decode ArrayBuffer to AudioBuffer
 * @param arrayBuffer - Audio data as ArrayBuffer
 * @returns Decoded AudioBuffer
 */
export async function decodeArrayBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const audioContext = getAudioContext();

    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (error) {
        throw new Error(`Failed to decode audio buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Check if file extension is supported
 */
function isSupportedFileExtension(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return ['mp3', 'wav', 'ogg'].includes(extension || '');
}

/**
 * Convert AudioBuffer to Float32Array (mono)
 * @param audioBuffer - Input AudioBuffer
 * @returns Float32Array with mono audio data
 */
export function audioBufferToFloat32Array(audioBuffer: AudioBuffer): Float32Array {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    if (numberOfChannels === 1) {
        // Already mono
        return audioBuffer.getChannelData(0);
    }

    // Mix down to mono
    const output = new Float32Array(length);
    for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            output[i] += channelData[i] / numberOfChannels;
        }
    }

    return output;
}

/**
 * Convert AudioBuffer to stereo Float32Array
 * @param audioBuffer - Input AudioBuffer
 * @returns Object with left and right channel data
 */
export function audioBufferToStereo(audioBuffer: AudioBuffer): { left: Float32Array; right: Float32Array } {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    if (numberOfChannels === 1) {
        // Duplicate mono to stereo
        const data = audioBuffer.getChannelData(0);
        return { left: data, right: data };
    }

    return {
        left: audioBuffer.getChannelData(0),
        right: audioBuffer.getChannelData(1),
    };
}

/**
 * Create AudioBuffer from Float32Array
 */
export function float32ArrayToAudioBuffer(
    data: Float32Array,
    sampleRate: number = 44100,
    numberOfChannels: number = 1
): AudioBuffer {
    const audioContext = getAudioContext();
    const audioBuffer = audioContext.createBuffer(numberOfChannels, data.length, sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        channelData.set(data);
    }

    return audioBuffer;
}

/**
 * Get audio file metadata
 */
export async function getAudioMetadata(file: File) {
    const audioBuffer = await decodeAudioFile(file);

    return {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        length: audioBuffer.length,
        fileSize: file.size,
        fileName: file.name,
        fileType: file.type,
    };
}
