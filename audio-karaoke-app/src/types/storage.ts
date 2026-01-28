/**
 * IndexedDB storage type definitions
 */

export interface CachedAudio {
    id?: number;
    fileHash: string;
    fileName: string;
    vocals: ArrayBuffer;
    instrumentals: ArrayBuffer;
    originalSize: number;
    processedAt: number;
    duration: number;
    sampleRate: number;
}

export interface ProcessingLog {
    id?: number;
    fileHash: string;
    fileName: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: number; // 0-100
    startedAt: number;
    completedAt?: number;
    error?: string;
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
