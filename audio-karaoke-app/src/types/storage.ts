/**
 * IndexedDB storage type definitions
 */

export interface CachedAudio {
    id?: number;
    fileHash: string; // SHA-256 of original file
    fileName: string;
    fileSizeBytes: number;
    vocals: ArrayBuffer; // Processed vocals
    instrumentals: ArrayBuffer; // Processed instrumentals
    originalSize: number; // Keep for backward compatibility or remove if strictly following guide
    processedAt: number; // timestamp
    duration: number; // in seconds
    sampleRate: number;
    modelUsed: string; // Model used for separation
    lyrics?: string; // Raw LRC content
}

export interface ProcessingLog {
    id?: number;
    fileHash: string;
    fileName?: string; // Optional in guide, present in current
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: number; // 0-100
    startedAt: number;
    completedAt?: number;
    errorMessage?: string; // Guide uses errorMessage
    error?: string; // Keep for backward compatibility
}

export interface SongEntry {
    id?: number;
    type: 'ai_separated' | 'direct_karaoke';
    title: string;
    artist?: string;
    versionName: string;      // e.g., "Original", "Lowered Key", "Fast Remix"

    // Enhanced Metadata
    album?: string;
    genre?: string[];
    year?: number;
    bpm?: number;
    key?: string;

    // Audio Data - Hybrid Storage Support
    instrumentalPath?: string; // Path to OPFS file
    vocalPath?: string;       // Path to OPFS file
    
    // Legacy / Buffer Data (Deprecated for new entries)
    instrumentalData?: ArrayBuffer;
    vocalData?: ArrayBuffer;

    // Metadata & Settings
    originalHash: string;
    pitchAdjustment: number;  // semitones
    tempoMultiplier: number;  // e.g., 1.1 for +10%
    duration: number;

    // Timestamps
    createdAt: number;
    updatedAt?: number;
    playCount?: number;
    lastPlayedAt?: number;
}

export interface StorageQuota {
    usage: number; // Bytes used
    quota: number; // Total bytes available
    percentage: number; // Usage percentage
}

export interface StorageStats {
    totalSize: number;
    modelsSize: number;
    audioSize: number;
    quota: StorageQuota;
    cachedAudioCount: number;
    cachedModelsCount: number;
}

/**
 * Playlist type for organizing songs
 */
export interface Playlist {
    id?: number;
    name: string;
    songIds: number[];
    createdAt: number;
    updatedAt: number;
    isDefault?: boolean;
}

/**
 * Queue state for playback queue
 */
export interface QueueState {
    id?: number;
    songIds: number[];
    currentIndex: number;
    shuffleMode: 'off' | 'on';
    repeatMode: 'off' | 'all' | 'one';
    updatedAt: number;
}

/**
 * Filter options for library
 */
export type FilterType = 'all' | 'ai_separated' | 'direct_karaoke';

/**
 * Sort options for library
 */
export type SortOption = 'date' | 'title' | 'artist' | 'duration';

/**
 * Sort order for library
 */
export type SortOrder = 'asc' | 'desc';
