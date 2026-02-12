/**
 * Audio Memory Manager
 * 
 * Manages memory allocation for audio processing to prevent
 * memory exhaustion with large audio files.
 */

/**
 * Memory limits configuration
 */
export const MEMORY_LIMITS = {
    /** Maximum audio duration in seconds (30 minutes) */
    MAX_DURATION_SECONDS: 30 * 60,
    /** Maximum memory allocation in bytes (512MB) */
    MAX_MEMORY_BYTES: 512 * 1024 * 1024,
    /** Warning threshold (80% of max) */
    WARNING_THRESHOLD: 0.8,
    /** Sample rate assumption for calculations */
    DEFAULT_SAMPLE_RATE: 44100,
    /** Bytes per sample (Float32) */
    BYTES_PER_SAMPLE: 4,
    /** Number of channels (stereo) */
    DEFAULT_CHANNELS: 2,
};

/**
 * Memory usage information
 */
export interface MemoryInfo {
    used: number;
    available: number;
    percentage: number;
    isNearLimit: boolean;
}

/**
 * Audio buffer size estimation
 */
export interface AudioSizeInfo {
    duration: number;
    sampleRate: number;
    channels: number;
    estimatedBytes: number;
    isWithinLimits: boolean;
    warningMessage?: string;
}

/**
 * Estimate memory required for an audio buffer
 */
export function estimateAudioBufferSize(
    durationSeconds: number,
    sampleRate: number = MEMORY_LIMITS.DEFAULT_SAMPLE_RATE,
    channels: number = MEMORY_LIMITS.DEFAULT_CHANNELS
): AudioSizeInfo {
    const samples = Math.ceil(durationSeconds * sampleRate);
    const estimatedBytes = samples * channels * MEMORY_LIMITS.BYTES_PER_SAMPLE;
    
    const isWithinLimits = 
        durationSeconds <= MEMORY_LIMITS.MAX_DURATION_SECONDS &&
        estimatedBytes <= MEMORY_LIMITS.MAX_MEMORY_BYTES;
    
    let warningMessage: string | undefined;
    
    if (durationSeconds > MEMORY_LIMITS.MAX_DURATION_SECONDS) {
        warningMessage = `Audio duration (${formatDuration(durationSeconds)}) exceeds maximum allowed (${formatDuration(MEMORY_LIMITS.MAX_DURATION_SECONDS)})`;
    } else if (estimatedBytes > MEMORY_LIMITS.MAX_MEMORY_BYTES * MEMORY_LIMITS.WARNING_THRESHOLD) {
        warningMessage = `Audio file is large (${formatBytes(estimatedBytes)}). Processing may be slow.`;
    }
    
    return {
        duration: durationSeconds,
        sampleRate,
        channels,
        estimatedBytes,
        isWithinLimits,
        warningMessage
    };
}

/**
 * Get current memory usage (if available)
 */
export function getMemoryInfo(): MemoryInfo | null {
    // Check if performance.memory is available (Chrome only)
    const performanceWithMemory = performance as typeof performance & {
        memory?: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
        };
    };
    
    if (!performanceWithMemory.memory) {
        return null;
    }
    
    const { usedJSHeapSize, jsHeapSizeLimit } = performanceWithMemory.memory;
    const percentage = (usedJSHeapSize / jsHeapSizeLimit) * 100;
    
    return {
        used: usedJSHeapSize,
        available: jsHeapSizeLimit - usedJSHeapSize,
        percentage,
        isNearLimit: percentage > MEMORY_LIMITS.WARNING_THRESHOLD * 100
    };
}

/**
 * Check if there's enough memory for an operation
 */
export function checkMemoryAvailable(requiredBytes: number): {
    available: boolean;
    message?: string;
} {
    const memoryInfo = getMemoryInfo();
    
    if (!memoryInfo) {
        // Can't determine, allow with warning
        return {
            available: true,
            message: 'Memory monitoring not available in this browser'
        };
    }
    
    if (requiredBytes > memoryInfo.available) {
        return {
            available: false,
            message: `Insufficient memory. Required: ${formatBytes(requiredBytes)}, Available: ${formatBytes(memoryInfo.available)}`
        };
    }
    
    if (memoryInfo.isNearLimit) {
        return {
            available: true,
            message: `Warning: Memory usage is high (${memoryInfo.percentage.toFixed(1)}%)`
        };
    }
    
    return { available: true };
}

/**
 * Force garbage collection hint (where supported)
 */
export function suggestGarbageCollection(): void {
    // Force GC is only available with --expose-gc flag in Node
    // In browser, we can only hint by clearing references
    if (typeof globalThis !== 'undefined' && 'gc' in globalThis) {
        try {
            (globalThis as typeof globalThis & { gc: () => void }).gc();
        } catch {
            // GC not available
        }
    }
}

/**
 * Audio buffer pool for reusing buffers
 */
export class AudioBufferPool {
    private pool: Map<string, AudioBuffer[]> = new Map();
    private maxPoolSize: number;
    private totalBytes: number = 0;
    
    constructor(maxPoolSizeBytes: number = 100 * 1024 * 1024) {
        this.maxPoolSize = maxPoolSizeBytes;
    }
    
    /**
     * Get a buffer from the pool or create a new one
     */
    acquire(
        audioContext: AudioContext | OfflineAudioContext,
        length: number,
        sampleRate: number,
        channels: number = 2
    ): AudioBuffer {
        const key = `${length}_${sampleRate}_${channels}`;
        const poolBuffers = this.pool.get(key);
        
        if (poolBuffers && poolBuffers.length > 0) {
            return poolBuffers.pop()!;
        }
        
        return audioContext.createBuffer(channels, length, sampleRate);
    }
    
    /**
     * Return a buffer to the pool
     */
    release(buffer: AudioBuffer): void {
        const key = `${buffer.length}_${buffer.sampleRate}_${buffer.numberOfChannels}`;
        const bufferBytes = buffer.length * buffer.numberOfChannels * MEMORY_LIMITS.BYTES_PER_SAMPLE;
        
        // Check if we have space in the pool
        if (this.totalBytes + bufferBytes > this.maxPoolSize) {
            // Don't pool, let it be garbage collected
            return;
        }
        
        if (!this.pool.has(key)) {
            this.pool.set(key, []);
        }
        
        this.pool.get(key)!.push(buffer);
        this.totalBytes += bufferBytes;
    }
    
    /**
     * Clear the pool
     */
    clear(): void {
        this.pool.clear();
        this.totalBytes = 0;
    }
    
    /**
     * Get pool statistics
     */
    getStats(): { bufferCount: number; totalBytes: number } {
        let count = 0;
        for (const buffers of this.pool.values()) {
            count += buffers.length;
        }
        return {
            bufferCount: count,
            totalBytes: this.totalBytes
        };
    }
}

/**
 * Singleton buffer pool instance
 */
export const audioBufferPool = new AudioBufferPool();

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let value = bytes;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    
    return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration to human readable string
 */
function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

/**
 * Validate audio file before processing
 */
export function validateAudioFile(
    durationSeconds: number,
    fileSizeBytes: number
): { valid: boolean; error?: string; warning?: string } {
    // Check duration
    if (durationSeconds > MEMORY_LIMITS.MAX_DURATION_SECONDS) {
        return {
            valid: false,
            error: `Audio file is too long (${formatDuration(durationSeconds)}). Maximum allowed: ${formatDuration(MEMORY_LIMITS.MAX_DURATION_SECONDS)}`
        };
    }
    
    // Estimate memory needed
    const sizeInfo = estimateAudioBufferSize(durationSeconds);
    
    // Check memory availability
    const memoryCheck = checkMemoryAvailable(sizeInfo.estimatedBytes);
    if (!memoryCheck.available) {
        return {
            valid: false,
            error: memoryCheck.message
        };
    }
    
    return {
        valid: true,
        warning: sizeInfo.warningMessage || memoryCheck.message
    };
}

/**
 * Clean up audio resources
 */
export function cleanupAudioResources(
    audioContext?: AudioContext | null,
    buffers?: (AudioBuffer | null)[],
    blobUrls?: string[]
): void {
    // Close audio context
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(err => {
            console.warn('Failed to close audio context:', err);
        });
    }
    
    // Release buffers to pool (optional - they'll be GC'd otherwise)
    if (buffers) {
        for (const buffer of buffers) {
            if (buffer) {
                audioBufferPool.release(buffer);
            }
        }
    }
    
    // Revoke blob URLs
    if (blobUrls) {
        for (const url of blobUrls) {
            URL.revokeObjectURL(url);
        }
    }
}
