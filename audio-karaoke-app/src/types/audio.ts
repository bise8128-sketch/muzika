/**
 * Audio type definitions for the karaoke separation app
 */

import type { SongEntry } from './storage';

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

/**
 * Player state for managing playback queue and playback modes
 */
export interface PlayerState {
    songs: SongEntry[];
    currentIndex: number;
    shuffleMode: boolean;
    repeatMode: 'off' | 'all' | 'one';
}

/**
 * Stem isolation types for multi-track mixing
 */
export type StemType = 'vocals' | 'drums' | 'bass' | 'other' | 'instrumental';

export interface StemSettings {
    type: StemType;
    label: string;
    volume: number;   // 0 to 1
    muted: boolean;
    solo: boolean;
    icon: string;      // Emoji icon for UI
}

export type StemPreset = 'full-mix' | 'karaoke' | 'a-capella' | 'drums-only' | 'bass-only';

/**
 * Pitch analysis types for vocal performance scoring
 */
export interface PitchAnalysisResult {
    detectedPitch: number;    // Hz (0 = no pitch)
    detectedMidi: number;     // MIDI note number
    referencePitch: number;   // Hz
    referenceMidi: number;    // MIDI note number
    centDeviation: number;    // Deviation in cents (-100 to +100)
    accuracy: number;         // 0 to 100%
    timestamp: number;        // Seconds
    confidence: number;       // 0 to 1
}

export type PerformanceGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface PerformanceScore {
    overallAccuracy: number;    // 0 to 100%
    grade: PerformanceGrade;
    notesHit: number;
    totalNotes: number;
    longestStreak: number;
    history: PitchAnalysisResult[];
}

// ─── Practice Mode Types ────────────────────────────────────────────

/** A section of a song identified as difficult based on pitch analysis */
export interface DifficultSection {
    id: string;
    startTime: number;         // seconds
    endTime: number;           // seconds
    averageAccuracy: number;   // 0–100
    frameCount: number;        // number of analysis frames in this section
    label: string;             // e.g. "0:32 – 0:45"
}

/** Settings controlling how practice mode behaves */
export interface PracticeSettings {
    accuracyThreshold: number;      // sections below this % are "difficult" (default 60)
    minSectionDuration: number;     // min section length in seconds (default 2)
    maxSectionDuration: number;     // max section length in seconds (default 15)
    initialTempoFactor: number;     // start tempo multiplier (default 0.7 = 70%)
    tempoStepUp: number;            // increase tempo by this per successful attempt (default 0.1)
    advanceThreshold: number;       // accuracy % to consider section mastered (default 80)
    maxAttempts: number;            // max attempts before auto-advancing (default 10)
    leadInSeconds: number;          // seconds of audio before section start (default 1)
}

/** A single attempt at practicing a section */
export interface PracticeAttempt {
    sectionId: string;
    attemptNumber: number;
    accuracy: number;              // 0–100
    tempo: number;                 // tempo multiplier used
    timestamp: number;             // Date.now()
}

/** Full practice session data */
export interface PracticeSession {
    id: string;
    songId: string;
    startedAt: number;
    endedAt?: number;
    sections: DifficultSection[];
    attempts: PracticeAttempt[];
    overallImprovement: number;    // accuracy delta from first to last attempt
}

/** Long-term progress for a song */
export interface PracticeProgress {
    songId: string;
    sessionsCompleted: number;
    bestAccuracy: number;
    lastPracticedAt: number;
    sectionProgress: Record<string, { bestAccuracy: number; attemptCount: number }>;
}

// ─── Voice Transformation Types ─────────────────────────────────────

export type VoicePreset = 'original' | 'deep' | 'high' | 'robot' | 'chipmunk' | 'harmony';

/** Configuration for a single harmony voice */
export interface HarmonyVoice {
    interval: number;      // semitones offset from original (-12 to +12)
    volume: number;        // 0 to 1
    pan: number;           // -1 (left) to +1 (right)
    enabled: boolean;
}

/** Settings controlling voice transformation */
export interface VoiceTransformSettings {
    preset: VoicePreset;
    formantShift: number;          // semitones (-12 to +12)
    pitchShift: number;            // semitones (additive, on top of existing)
    harmonies: HarmonyVoice[];     // up to 3 harmony voices
    dryWet: number;                // 0 (dry) to 1 (fully transformed)
}

/** Preset definitions for voice presets */
export const VOICE_PRESETS: Record<VoicePreset, Omit<VoiceTransformSettings, 'preset'>> = {
    original: { formantShift: 0, pitchShift: 0, harmonies: [], dryWet: 0 },
    deep: { formantShift: -4, pitchShift: -2, harmonies: [], dryWet: 0.8 },
    high: { formantShift: 4, pitchShift: 2, harmonies: [], dryWet: 0.8 },
    robot: { formantShift: 0, pitchShift: 0, harmonies: [], dryWet: 1.0 },
    chipmunk: { formantShift: 8, pitchShift: 5, harmonies: [], dryWet: 1.0 },
    harmony: {
        formantShift: 0,
        pitchShift: 0,
        harmonies: [
            { interval: 4, volume: 0.5, pan: -0.5, enabled: true },
            { interval: 7, volume: 0.4, pan: 0.5, enabled: true },
        ],
        dryWet: 0.6,
    },
};
