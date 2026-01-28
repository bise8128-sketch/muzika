import type { WorkerRequest, WorkerResponse } from '@/types/worker';
import { loadModel } from '@/utils/ml/modelManager';
import type { ModelInfo } from '@/types/model';

const ctx: Worker = self as any;

/**
 * Model Loader Worker
 * 
 * Responsibilities:
 * - Pre-fetch models in the background
 * - Store in IndexedDB cache
 * - Report download progress
 */
ctx.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
    const { type, payload } = event.data;

    try {
        if (type === 'LOAD_MODEL') {
            const modelInfo = payload as ModelInfo;

            await loadModel(modelInfo, (p) => {
                ctx.postMessage({
                    type: 'PROGRESS',
                    payload: { modelId: modelInfo.id, progress: p }
                } as WorkerResponse);
            });

            ctx.postMessage({
                type: 'SUCCESS',
                payload: { modelId: modelInfo.id }
            } as WorkerResponse);
        }
    } catch (error: any) {
        ctx.postMessage({
            type: 'ERROR',
            payload: { modelId: (payload as any)?.id, message: error.message }
        } as WorkerResponse);
    }
});
