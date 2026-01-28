import type { ModelInfo, ModelDownloadProgress } from '@/types/model';
import { saveModel } from '@/utils/storage/modelStorage';

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

    const response = await fetch(modelInfo.url);
    if (!response.ok) {
        throw new Error(`Failed to download model: ${response.statusText}`);
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
    await saveModel(modelInfo, modelData);

    return modelData;
}
