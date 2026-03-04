/**
 * IndexedDB storage type definitions
 */
import type { ExtractedMetadata } from './schema';

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

export interface LyricSyncCacheEntry {
    id?: number;
    fileHash: string; // SHA-256 of original file
    modelUsed: string; // e.g. "whisper-tiny-en"
    processedAt: number; // timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any; // SyncResult
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

export interface ProcessingJob {
    id?: number;
    fileId: string;           // Reference to audioFiles (usually fileHash)
    fileName: string;         // Human readable name for UI
    fileHash: string;         // Hash to check if already cached
    modelId: string;          // e.g. 'htdemucs'
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'queued';
    progress: number;
    error?: string;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    addedAt?: number;
    
    // Metadata for lyric fetching
    artist?: string;
    title?: string;
    duration?: number;
}

export interface SongEntry {
    id?: number;
    type: 'ai_separated' | 'direct_karaoke';
    title: string;
    artist?: string;
    album?: string;
    genre?: string;
    year?: number | string;
    versionName?: string; // e.g. "Original", "Live", "Remix"
    
    // Performance stats
    lastScore?: number;
    highScore?: number;
    
    // File references
    originalHash: string;
    modelUsed?: string;   // e.g. "htdemucs"
    
    // Decoupled Storage references (OPFS or IndexedDB IDs)
    vocalPath?: string;
    instrumentalPath?: string;
    
    // Legacy / Buffer Data (Deprecated for new entries)
    instrumentalData?: ArrayBuffer;
    vocalData?: ArrayBuffer;

    // Metadata & Settings
    pitchAdjustment: number;  // semitones
    tempoMultiplier: number;  // e.g., 1.1 for +10%
    duration: number;

    // Timestamps
    createdAt: number;
    updatedAt?: number;
    playCount?: number;
    lastPlayedAt?: number;

    // Sync Metadata
    serverSyncedAt?: number;
    isDirty?: boolean;
    serverId?: string | number;

    // Lyrics
    lyrics?: string;

    // Additional metadata from extraction
    metadata?: ExtractedMetadata;
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

export type SmartPlaylistRuleField = 'title' | 'artist' | 'album' | 'genre' | 'year' | 'duration' | 'createdAt';
export type SmartPlaylistRuleOperator = 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'not_contains' | 'is_not' | 'not_starts_with' | 'not_ends_with';

export interface SmartPlaylistRule {
    id: string;
    field: SmartPlaylistRuleField;
    operator: SmartPlaylistRuleOperator;
    value: string | number;
}

/**
 * Playlist type for organizing songs
 */
export interface Playlist {
    id?: number;
    name: string;
    type: 'manual' | 'smart';
    songIds: number[]; // Used for manual playlists
    rules?: SmartPlaylistRule[]; // Used for smart playlists
    createdAt: number;
    updatedAt: number;
    isDefault?: boolean;

    // Sync Metadata
    serverSyncedAt?: number;
    isDirty?: boolean;
    serverId?: string | number;
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

    // Sync Metadata
    serverSyncedAt?: number;
    isDirty?: boolean;
    serverId?: string | number;
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
