/**
 * Audio type definitions for the karaoke separation app
 */

export interface AudioBufferData {
    channelData: Float32Array[];
    sampleRate: number;
    duration: number;
    numberOfChannels: number;
}

export interface SeparationResult {
    vocals: AudioBuffer;
    instrumentals: AudioBuffer;
    originalAudio: AudioBuffer;
    timestamp: number;
    fileHash: string;
}

export interface ProcessingProgress {
    phase: 'loading-model' | 'decoding' | 'segmenting' | 'separating' | 'merging' | 'caching';
    currentSegment: number;
    totalSegments: number;
    percentage: number;
    message?: string;
}

export interface AudioSegment {
    data: Float32Array;
    startTime: number;
    endTime: number;
    sampleRate: number;
}

export interface LyricLine {
    text: string;
    startTime: number;
    endTime: number;
    startColor?: string;
    endColor?: string;
}

export interface KaraokeSettings {
    vocalVolume: number; // 0-1
    instrumentalVolume: number; // 0-1
    pitchShift: number; // -12 to +12 semitones
    tempoChange: number; // 0.5 to 2.0
    reverbAmount: number; // 0-1
    echoAmount: number; // 0-1
}

export type AudioFormat = 'mp3' | 'wav' | 'ogg';

export interface ExportOptions {
    format: AudioFormat;
    quality: 'low' | 'medium' | 'high';
    bitrate?: number; // For MP3: 128, 192, 256, 320 kbps
}
