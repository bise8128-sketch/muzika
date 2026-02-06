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

export interface SavedSong {
    id?: number;
    originalHash: string;      // SHA-256 of the original file
    customName: string;        // User-defined name (e.g., "My Favorite Song - Low Pitch")
    fileName: string;          // Original filename
    pitch: number;             // Pitch adjustment (e.g., -2, 0, +2)
    tempo: number;             // Tempo multiplier (e.g., 0.9, 1.0, 1.1)
    vocals: ArrayBuffer;       // Processed vocal stem
    instrumentals: ArrayBuffer; // Processed instrumental stem
    modelUsed: string;         // AI model used for separation
    savedAt: number;           // Timestamp
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
