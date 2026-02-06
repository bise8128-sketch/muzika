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

    // Audio Data
    instrumentalData: ArrayBuffer;
    vocalData?: ArrayBuffer;  // Optional for direct karaoke

    // Metadata & Settings
    originalHash: string;
    pitchAdjustment: number;  // semitones
    tempoMultiplier: number;  // e.g., 1.1 for +10%
    duration: number;

    // Timestamps
    createdAt: number;
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
