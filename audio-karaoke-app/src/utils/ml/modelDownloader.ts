import type { ModelInfo, ModelDownloadProgress } from '@/types/model';
import { modelStorage } from '@/utils/storage/modelStorage';
import { StorageManager } from '@/utils/storage/StorageManager';

/**
 * Downloads a model file from a URL with progress tracking.
 * Stores the downloaded data in IndexedDB.
 */
export async function downloadModel(
    modelInfo: ModelInfo,
    onProgress?: (progress: ModelDownloadProgress) => void
): Promise<ArrayBuffer> {
    if (!modelInfo.url) {
        throw new Error(`No URL provided for model ${modelInfo.id}`);
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
        response = await fetch(fetchUrl);
    } catch (err) {
        console.error(`[modelDownloader] fetch failed for ${fetchUrl}:`, err);
        throw new Error(`Failed to fetch model from ${fetchUrl}. This may be due to CORS, network issues, or an invalid URL.`);
    }

    if (!response.ok) {
        throw new Error(`Failed to download model from ${modelInfo.url}: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Failed to get response body reader');
    }

    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;

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

    // Save to storage
    await StorageManager.runWithRetry(
        () => modelStorage.saveModel(modelInfo, modelData),
        `Saving model ${modelInfo.name}`
    );

    return modelData;
}
