import type { WorkerRequest, WorkerResponse, SeparationChunkPayload } from '@/types/worker';
import { loadModel } from '@/utils/ml/modelManager';
import { runInference } from '@/utils/ml/inference';
import type { ModelInfo } from '@/types/model';

// We need to polyfill/handle self for worker environment
const ctx: Worker = self as any;

/**
 * Audio Separation Worker
 * 
 * Responsibilities:
 * - Load ONNX models without blocking UI
 * - Run inference on audio segments
 * - Report progress back to main thread
 */
ctx.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
    const { type, payload } = event.data;

    try {
        switch (type) {
            case 'LOAD_MODEL': {
                const modelInfo = payload as ModelInfo;
                ctx.postMessage({ type: 'PROGRESS', payload: { status: 'loading-model', message: `Loading model ${modelInfo.name}...` } } as WorkerResponse);

                await loadModel(modelInfo, (p) => {
                    ctx.postMessage({ type: 'PROGRESS', payload: { status: 'downloading', progress: p } } as WorkerResponse);
                });

                ctx.postMessage({ type: 'SUCCESS', payload: { modelId: modelInfo.id } } as WorkerResponse);
                break;
            }

            case 'SEPARATE_CHUNK': {
                const { inputData, channels, samples, modelId, chunkIndex } = payload as SeparationChunkPayload;

                // Ensure model is loaded (modelManager handles cache)
                // Note: For actual separate_chunk, we expect the model to be pre-loaded, 
                // but loadModel is idempotent so it's safe.
                // In a real scenario, we'd pass the modelInfo here or have it pre-registered.
                // For simplicity, we assume the model is already in modelManager cache.

                // This part is tricky because the worker needs a way to get the session.
                // modelManager.ts maintains a local cache. Since this worker runs in its own thread,
                // it has its OWN instance of modelManager.ts.

                // We need the modelInfo to load it if not cached.
                // Assuming payload includes modelInfo or we have it.
                const modelInfo = (payload as any).modelInfo as ModelInfo;
                const session = await loadModel(modelInfo);

                const results = await runInference(session, inputData, channels, samples);

                ctx.postMessage({
                    type: 'SUCCESS',
                    payload: {
                        vocals: results.vocals,
                        instrumentals: results.instrumentals,
                        chunkIndex
                    }
                } as WorkerResponse, [results.vocals.buffer, results.instrumentals.buffer]); // Transfer buffers for performance
                break;
            }

            case 'CANCEL':
                // Handle cancellation logic if needed
                break;

            default:
                console.warn('Unknown message type received in worker:', type);
        }
    } catch (error: any) {
        ctx.postMessage({
            type: 'ERROR',
            payload: { message: error.message || 'Unknown worker error', stack: error.stack }
        } as WorkerResponse);
    }
});
