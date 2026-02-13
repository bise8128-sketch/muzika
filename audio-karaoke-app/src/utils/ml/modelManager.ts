import type { ModelInfo, ModelDownloadProgress } from '@/types/model';
import { modelStorage } from '@/utils/storage/modelStorage';
import { downloadModel } from './modelDownloader';
import { setupONNX, validateSessionProvider } from './onnxSetup';
import { InferenceEngine } from './inference';
import * as ort from 'onnxruntime-web';

// Memory cache for loaded sessions
const sessionCache = new Map<string, ort.InferenceSession>();

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
    if (await modelStorage.modelExists(modelInfo.id)) {
        console.log(`Loading model ${modelInfo.id} from IndexedDB cache...`);
        modelData = await modelStorage.getModel(modelInfo.id);
    }

    // If not in cache, download it
    if (!modelData) {
        console.log(`Model ${modelInfo.id} not found in cache. Downloading...`);
        modelData = await downloadModel(modelInfo, onProgress);
    }


    // Setup ONNX options (WebGPU vs WASM)
    console.log(`[modelManager] Setting up ONNX for model ${modelInfo.id}...`);
    const options = await setupONNX();

    // Create InferenceSession
    try {
        console.log(`[modelManager] Creating InferenceSession for model ${modelInfo.id}...`);
        let session: ort.InferenceSession;
        let usedWebGPU = false;

        try {
            session = await ort.InferenceSession.create(modelData, options);
            console.log(`[modelManager] InferenceSession created successfully with providers: ${(session as any).executionProviders?.join(', ') || 'unknown'}`);
            
            usedWebGPU = !!(options.executionProviders &&
                (Array.isArray(options.executionProviders) ?
                    options.executionProviders.some(ep => ep === 'webgpu' || (typeof ep === 'object' && (ep as any).name === 'webgpu')) :
                    false));

        } catch (webGpuError) {
            // Check if we were trying to use WebGPU
             usedWebGPU = !!(options.executionProviders &&
                (Array.isArray(options.executionProviders) ?
                    options.executionProviders.some(ep => ep === 'webgpu' || (typeof ep === 'object' && (ep as any).name === 'webgpu')) :
                    false));

            if (usedWebGPU) {
                console.warn(`[modelManager] WebGPU initialization failed for model ${modelInfo.id}. Falling back to CPU (WASM)...`, webGpuError);

                // Fallback options: remove WebGPU from execution providers
                const fallbackOptions = { ...options };
                fallbackOptions.executionProviders = ['wasm'];

                // Create session with fallback options
                try {
                    session = await ort.InferenceSession.create(modelData, fallbackOptions);
                    console.log(`[modelManager] Fallback InferenceSession created successfully (CPU/WASM) for model ${modelInfo.id}`);
                    usedWebGPU = false; // We explicitly fell back, so we are not "attempting" WebGPU anymore in terms of silent failure check
                } catch (wasmError) {
                    console.error(`[modelManager] WASM fallback also failed for model ${modelInfo.id}:`, wasmError);
                    throw wasmError;
                }
            } else {
                throw webGpuError;
            }
        }

        console.log(`[modelManager] InferenceSession created successfully for model ${modelInfo.id}`);

        // Runtime Validation: Check illegal fallback
        // If we successfully created a session with WebGPU options, check if it actually uses it
        const validation = validateSessionProvider(session, usedWebGPU);
        
        if (validation.didFallback) {
             console.warn(`[modelManager] WebGPU was requested but session fell back to ${validation.backend}`);
        } else {
             console.log(`[modelManager] Session verified using backend: ${validation.backend}`);
        }

        // We do NOT cache the engine directly because engines are stateful (strategies might be stateful)
        // But sessions are stateless and expensive. We cache sessions.
        sessionCache.set(modelInfo.id, session);

        // Return new engine instance with the cached session
        const engine = new InferenceEngine(session, modelInfo);
        engine.backendInfo = validation;
        await engine.init();
        return engine;
    } catch (err) {
        console.error(`[modelManager] Failed to create ONNX session for model ${modelInfo.id}:`, err);
        throw err;
    }
}

/**
 * Explicitly removes a model from memory cache and releases resources.
 */
export function unloadModel(modelId: string): void {
    const session = sessionCache.get(modelId);
    if (session) {
        try {
            session.release();
        } catch (e) {
            console.warn(`[modelManager] Failed to release session for ${modelId}:`, e);
        }
        sessionCache.delete(modelId);
    }
}

/**
 * Checks if a model is currently loaded in memory.
 */
export function isModelLoaded(modelId: string): boolean {
    return sessionCache.has(modelId);
}

/**
 * Checks all models in storage and returns their current status.
 */
export async function checkModelAvailability() {
    const storedModels = await modelStorage.getAllModels();
    const stats = await modelStorage.getStorageStats();

    return {
        models: storedModels.map(m => ({
            id: m.id,
            name: m.name,
            version: m.version,
            size: m.size,
            downloadedAt: m.downloadedAt,
            isLoaded: isModelLoaded(m.id)
        })),
        diskUsage: stats.totalSize,
        quota: stats.quota
    };
}
