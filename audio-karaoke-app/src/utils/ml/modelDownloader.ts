import type { ModelInfo, ModelDownloadProgress } from '@/types/model';
import { modelStorage } from '@/utils/storage/modelStorage';
import { StorageManager } from '../storage/StorageManager';
import { ModelLoadError, NetworkFetchError, StorageQuotaError } from '../../errors';
import { calculateSHA256 } from '../crypto';
import { CircuitBreaker, CircuitOpenError } from '../reliability/CircuitBreaker';

// Retry configuration
export interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitterFactor: number; // 0-1, percentage of delay to randomize
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitterFactor: 0.5, // 50% jitter
};

// Global circuit breaker for model downloads
const modelDownloadCircuitBreaker = new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
});

/**
 * Calculates exponential backoff delay with jitter to prevent thundering herd.
 * Uses "full jitter" strategy: random value between 0 and exponential delay.
 */
function calculateBackoffWithJitter(
    attempt: number,
    config: RetryConfig
): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = Math.min(
        config.maxDelayMs,
        config.baseDelayMs * Math.pow(2, attempt)
    );
    
    // Full jitter: random value between 0 and exponentialDelay
    const jitter = Math.random() * config.jitterFactor;
    const jitterRange = exponentialDelay * jitter;
    
    // Return delay with jitter applied
    return Math.floor(exponentialDelay - jitterRange + (Math.random() * jitterRange * 2));
}

/**
 * Sleeps for the specified duration unless aborted.
 */
async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new ModelLoadError('Download aborted by user.', true));
            return;
        }
        
        const timeout = setTimeout(resolve, ms);
        
        const onAbort = () => {
            clearTimeout(timeout);
            reject(new ModelLoadError('Download aborted by user.', true));
        };
        
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

/**
 * Performs a single download attempt with streaming progress.
 */
async function performDownload(
    fetchUrl: string,
    modelInfo: ModelInfo,
    onProgress?: (progress: ModelDownloadProgress) => void,
    signal?: AbortSignal
): Promise<ArrayBuffer> {
    const response = await fetch(fetchUrl, { signal });

    if (!response.ok) {
        throw new NetworkFetchError(
            `Failed to download model from ${modelInfo.url}: ${response.status} ${response.statusText}`,
            response.status
        );
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body?.getReader();
    if (!reader) {
        throw new ModelLoadError('Failed to get response body reader from model download.', true);
    }

    // Check for available storage before starting download if total size is known
    if (total > 0 && typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        const availableSpace = (estimate.quota ?? 0) - (estimate.usage ?? 0);
        if (estimate.quota !== undefined && total > availableSpace) {
            throw new StorageQuotaError(
                `Insufficient storage space for model ${modelInfo.name}. Required: ${total} bytes, Available: ${availableSpace} bytes.`
            );
        }
    }

    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;
        if (signal?.aborted) {
            reader.cancel();
            throw new ModelLoadError('Download aborted by user.', true);
        }

        chunks.push(value);
        loaded += value.length;

        if (onProgress) {
            onProgress({
                loaded,
                total,
                percentage: total ? (loaded / total) * 100 : 0
            });
        }
    }

    // Concatenate all chunks into a single ArrayBuffer
    const combined = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
    }

    return combined.buffer;
}

/**
 * Downloads a model file from a URL with progress tracking, exponential backoff retry,
 * jitter to prevent thundering herd, and circuit breaker protection.
 * Stores the downloaded data in IndexedDB.
 */
export async function downloadModel(
    modelInfo: ModelInfo,
    onProgress?: (progress: ModelDownloadProgress) => void,
    signal?: AbortSignal,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<ArrayBuffer> {
    if (signal?.aborted) {
        throw new ModelLoadError('Download aborted by user.', true);
    }
    if (!modelInfo.url) {
        throw new ModelLoadError(`No URL provided for model ${modelInfo.id}`);
    }

    // Construct full URL for Web Worker context
    let fetchUrl = modelInfo.url;
    if (fetchUrl.startsWith('/')) {
        let origin = '';
        if (typeof self !== 'undefined' && self.location) {
            origin = self.location.origin;
        } else if (typeof window !== 'undefined' && window.location) {
            origin = window.location.origin;
        } else if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).location) {
            origin = ((globalThis as Record<string, unknown>).location as Location).origin;
        }
        fetchUrl = `${origin}${fetchUrl}`;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {
        // Check if aborted before attempting
        if (signal?.aborted) {
            throw new ModelLoadError('Download aborted by user.', true);
        }

        try {
            // Use circuit breaker to fail fast if the endpoint is down
            const modelData = await modelDownloadCircuitBreaker.execute(async () => {
                console.log(
                    `[modelDownloader] Attempting download for ${modelInfo.name} (attempt ${attempt + 1}/${retryConfig.maxAttempts})`
                );
                
                return await performDownload(fetchUrl, modelInfo, onProgress, signal);
            });

            // Verify SHA256 checksum if provided
            if (modelInfo.sha256) {
                const calculatedHash = await calculateSHA256(modelData);
                
                if (calculatedHash.toLowerCase() !== modelInfo.sha256.toLowerCase()) {
                    throw new Error(
                        `SHA256 checksum mismatch for model ${modelInfo.name}. Expected ${modelInfo.sha256}, got ${calculatedHash}. The file may be corrupted.`
                    );
                }
                
                console.log(`[modelDownloader] SHA256 verification successful for ${modelInfo.name}`);
            }

            // Save to storage
            await StorageManager.runWithRetry(
                () => modelStorage.saveModel(modelInfo, modelData),
                `Saving model ${modelInfo.name}`
            );

            return modelData;
            
        } catch (err) {
            lastError = err as Error;
            
            // Don't retry on user abort
            if (signal?.aborted || lastError.message?.includes('aborted')) {
                throw new ModelLoadError('Download aborted by user.', true);
            }
            
            // Don't retry on storage quota errors - they won't resolve themselves
            if (err instanceof StorageQuotaError) {
                throw err;
            }
            
            // Circuit is open - don't retry immediately
            if (err instanceof CircuitOpenError) {
                console.warn(`[modelDownloader] Circuit breaker is open for ${modelInfo.name}. Will retry after reset.`);
                // Wait for circuit breaker reset timeout before retrying
                if (attempt < retryConfig.maxAttempts - 1) {
                    await sleep(retryConfig.maxDelayMs, signal);
                }
                continue;
            }
            
            // Log the error
            console.warn(
                `[modelDownloader] Download attempt ${attempt + 1} failed for ${modelInfo.name}:`,
                lastError.message
            );
            
            // Calculate backoff delay with jitter for next attempt
            if (attempt < retryConfig.maxAttempts - 1) {
                const delay = calculateBackoffWithJitter(attempt, retryConfig);
                console.log(`[modelDownloader] Retrying in ${delay}ms...`);
                await sleep(delay, signal);
            }
        }
    }

    // All retries exhausted
    throw new NetworkFetchError(
        `Failed to download model ${modelInfo.name} after ${retryConfig.maxAttempts} attempts. Last error: ${lastError?.message}`,
        undefined
    );
}

/**
 * Resets the circuit breaker for model downloads.
 * Useful for testing or manual recovery.
 */
export function resetModelDownloadCircuitBreaker(): void {
    modelDownloadCircuitBreaker.reset();
}

/**
 * Gets the current state of the model download circuit breaker.
 */
export function getModelDownloadCircuitBreakerState(): string {
    return modelDownloadCircuitBreaker.getStateString();
}
