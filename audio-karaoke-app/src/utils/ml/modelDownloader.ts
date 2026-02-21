import type { ModelInfo, ModelDownloadProgress } from '@/types/model';
import { modelStorage } from '@/utils/storage/modelStorage';
import { StorageManager } from '../storage/StorageManager';
import { ModelLoadError, NetworkFetchError, StorageQuotaError } from '../../errors';
import { calculateSHA256 } from '../crypto';

/**
 * Downloads a model file from a URL with progress tracking.
 * Stores the downloaded data in IndexedDB.
 */
export async function downloadModel(
    modelInfo: ModelInfo,
    onProgress?: (progress: ModelDownloadProgress) => void,
    signal?: AbortSignal
): Promise<ArrayBuffer> {
    if (signal?.aborted) {
        throw new ModelLoadError('Download aborted by user.', true);
    }
    if (!modelInfo.url) {
        throw new ModelLoadError(`No URL provided for model ${modelInfo.id}`);
    }

    // Construct full URL for Web Worker context
    // Web Workers don't automatically inherit the page's base URL
    let fetchUrl = modelInfo.url;
    if (fetchUrl.startsWith('/')) {
        // Get the origin from the current context (works in both main thread and worker)
        // Use global scope to Determine origin (works in Window and Worker)
        let origin = '';
        if (typeof self !== 'undefined' && self.location) {
            origin = self.location.origin;
        } else if (typeof window !== 'undefined' && window.location) {
            origin = window.location.origin;
        } else if (typeof globalThis !== 'undefined' && (globalThis as any).location) {
            origin = (globalThis as any).location.origin;
        }
        fetchUrl = `${origin}${fetchUrl}`;
    }

    let response: Response;
    try {
        response = await fetch(fetchUrl, { signal });
    } catch (err) {
        if (signal?.aborted) {
            throw new ModelLoadError('Download aborted by user.', true);
        }
        const error = err as Error;
        console.error(`[modelDownloader] fetch failed for ${fetchUrl}:`, error);
        throw new NetworkFetchError(`Failed to fetch model from ${fetchUrl}. This may be due to CORS, network issues, or an invalid URL. Error: ${error.message}`);
    }

    if (!response.ok) {
        throw new NetworkFetchError(`Failed to download model from ${modelInfo.url}: ${response.status} ${response.statusText}`, response.status);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body?.getReader();
    if (!reader) {
        throw new ModelLoadError('Failed to get response body reader from model download.', true);
    }

    // Check for available storage before starting download if total size is known
    if (total > 0) {
        const estimate = await navigator.storage.estimate();
        const availableSpace = (estimate.quota ?? 0) - (estimate.usage ?? 0);
        if (estimate.quota !== undefined && total > availableSpace) {
            throw new StorageQuotaError(`Insufficient storage space for model ${modelInfo.name}. Required: ${total} bytes, Available: ${availableSpace} bytes.`);
        }
    }

    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;
        if (signal?.aborted) {
            reader.cancel();
            throw new Error('Aborted');
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

    const modelData = combined.buffer;

    // Verify SHA256 checksum if provided
    if (modelInfo.sha256) {
        // Calculate hash
        const calculatedHash = await calculateSHA256(modelData);
        
        // Compare with expected hash (case-insensitive)
        if (calculatedHash.toLowerCase() !== modelInfo.sha256.toLowerCase()) {
            throw new Error(`SHA256 checksum mismatch for model ${modelInfo.name}. Expected ${modelInfo.sha256}, got ${calculatedHash}. The file may be corrupted.`);
        }
        
        console.log(`[modelDownloader] SHA256 verification successful for ${modelInfo.name}`);
    }

    // Save to storage
    await StorageManager.runWithRetry(
        () => modelStorage.saveModel(modelInfo, modelData),
        `Saving model ${modelInfo.name}`
    );

    return modelData;
}
