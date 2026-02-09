/**
 * Enhanced Data Schema for Song Library & Version Management
 * Derived from Prisma Schema definition
 */

export type SongType = 'AI_SEPARATED' | 'DIRECT_KARAOKE';

export interface EnhancedSongEntry {
    id: string; // Changed from number to string (UUID/CUID)
    type: SongType;
    title: string;
    artist?: string;
    duration: number; // in seconds

    // Metadata
    album?: string;
    genre?: string;
    year?: number;
    bpm?: number;
    key?: string;

    // Tracking
    createdAt: Date;
    updatedAt: Date;
    playCount: number;
    lastPlayedAt?: Date;

    // Relations
    versions: SongVersion[];
    tags: string[]; // Simplification for frontend

    // Original file info
    originalFileHash?: string;
    originalFileName?: string;
}

export interface SongVersion {
    id: string;
    songId: string;
    versionName: string; // e.g., "Original", "Lowered Key"
    isDefault: boolean;

    // Audio Adjustments
    pitchAdjustment: number; // semitones
    tempoMultiplier: number; // 1.0 = original speed

    // Audio Assets
    instrumentalUrl?: string; // Path or Blob URL
    vocalUrl?: string;       // Path or Blob URL
    lyricsUrl?: string;      // Path or Blob URL

    // Effect Snapshots
    reverbEnabled: boolean;
    reverbMix: number;
    echoEnabled: boolean;
    echoFeedback: number;

    createdAt: Date;
}

/**
 * Metadata extracted from file upload
 */
export interface ExtractedMetadata {
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    genre?: string[];
    year?: number;
    bpm?: number;
    picture?: {
        format: string;
        data: Uint8Array;
    };
}
