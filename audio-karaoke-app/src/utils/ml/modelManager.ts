import * as ort from 'onnxruntime-web';
import type { ModelInfo, ModelDownloadProgress } from '@/types/model';
import { getModel, modelExists } from '@/utils/storage/modelStorage';
import { downloadModel } from './modelDownloader';
import { setupONNX } from './onnxSetup';

// Memory cache for loaded sessions
const sessionCache = new Map<string, ort.InferenceSession>();

/**
 * Loads an ONNX model, either from IndexedDB cache or by downloading it.
 * Creates an InferenceSession and caches it in memory.
 */
import { InferenceEngine } from './inference';

/**
 * Loads an ONNX model, either from IndexedDB cache or by downloading it.
 * Creates an InferenceEngine with the loaded session.
 */
export async function loadModel(
    modelInfo: ModelInfo,
    onProgress?: (progress: ModelDownloadProgress) => void
): Promise<InferenceEngine> {
    // Return from memory cache if already loaded
    if (sessionCache.has(modelInfo.id)) {
        const session = sessionCache.get(modelInfo.id)!;
        const engine = new InferenceEngine(session, modelInfo);
        await engine.init();
        return engine;
    }

    let modelData: ArrayBuffer | null = null;

    // Check if model exists in IndexedDB
    if (await modelExists(modelInfo.id)) {
        console.log(`Loading model ${modelInfo.id} from IndexedDB cache...`);
        modelData = await getModel(modelInfo.id);
    }

    // If not in cache, download it
    if (!modelData) {
        console.log(`Model ${modelInfo.id} not found in cache. Downloading...`);
        modelData = await downloadModel(modelInfo, onProgress);
    }

    // Setup ONNX options (WebGPU vs WASM)
    const options = await setupONNX();

    // Create InferenceSession
    try {
        const session = await ort.InferenceSession.create(modelData, options);
        // We do NOT cache the engine directly because engines are stateful (strategies might be stateful)
        // But sessions are stateless and expensive. We cache sessions.
        sessionCache.set(modelInfo.id, session);

        // Return new engine instance with the cached session
        const { InferenceEngine } = await import('./inference');
        const engine = new InferenceEngine(session, modelInfo);
        await engine.init();
        return engine;
    } catch (err) {
        console.error(`Failed to create ONNX session for model ${modelInfo.id}:`, err);
        throw err;
    }
}

/**
 * Explicitly removes a model from memory cache and releases resources.
 */
export function unloadModel(modelId: string): void {
    const session = sessionCache.get(modelId);
    if (session) {
        // Note: InferenceSession doesn't have an explicit 'dispose' but we can null it out
        // and rely on GC. Tensors should be disposed separately.
        sessionCache.delete(modelId);
    }
}

/**
 * Checks if a model is currently loaded in memory.
 */
export function isModelLoaded(modelId: string): boolean {
    return sessionCache.has(modelId);
}
