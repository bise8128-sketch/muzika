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
    originalAudio?: AudioBuffer | null;
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

/**
 * Reverb effect settings
 */
export interface ReverbSettings {
    enabled: boolean;
    decay: number; // 0.1 to 10 seconds
    roomSize: 'small' | 'medium' | 'large' | 'hall';
    preDelay: number; // 0 to 200ms
    wetLevel: number; // 0 to 1
    dryLevel: number; // 0 to 1
    preset?: 'hall' | 'room' | 'plate' | 'chamber' | 'spring';
}

/**
 * Echo/Delay effect settings
 */
export interface EchoSettings {
    enabled: boolean;
    delayTime: number; // 50 to 1000ms
    feedback: number; // 0 to 0.9
    wetLevel: number; // 0 to 1
    dryLevel: number; // 0 to 1
    stereoDelay: boolean;
    leftDelay: number; // 50 to 1000ms
    rightDelay: number; // 50 to 1000ms
}

/**
 * Pitch correction effect settings
 */
export interface PitchCorrectionSettings {
    enabled: boolean;
    scale: 'chromatic' | 'major' | 'minor' | 'pentatonic-major' | 'pentatonic-minor';
    referenceKey: number; // 0-11 (C to B)
    retuneSpeed: number; // 0.1 to 1.0 (slow to fast)
    correctionAmount: number; // 0 to 1
    latency: number; // processing latency in ms
}

/**
 * Audio effects settings combining all effects
 */
export interface AudioEffectsSettings {
    reverb: ReverbSettings;
    echo: EchoSettings;
    pitchCorrection: PitchCorrectionSettings;
}

/**
 * Default audio effects settings
 */
export const DEFAULT_AUDIO_EFFECTS: AudioEffectsSettings = {
    reverb: {
        enabled: false,
        decay: 2.0,
        roomSize: 'medium',
        preDelay: 20,
        wetLevel: 0.3,
        dryLevel: 0.7,
        preset: 'room'
    },
    echo: {
        enabled: false,
        delayTime: 300,
        feedback: 0.3,
        wetLevel: 0.3,
        dryLevel: 0.7,
        stereoDelay: false,
        leftDelay: 300,
        rightDelay: 300
    },
    pitchCorrection: {
        enabled: false,
        scale: 'chromatic',
        referenceKey: 0,
        retuneSpeed: 0.5,
        correctionAmount: 0.8,
        latency: 50
    }
};

export type AudioFormat = 'mp3' | 'wav' | 'ogg';

export interface ExportOptions {
    format: AudioFormat;
    quality: 'low' | 'medium' | 'high';
    bitrate?: number; // For MP3: 128, 192, 256, 320 kbps
}
