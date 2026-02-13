
import * as ort from 'onnxruntime-web';
import type { InferenceOutput, ModelInfo } from '@/types/model';
import { ModelType } from '@/types/model';
import type { InferenceStrategy } from './inference/types';
import { WaveformInferenceStrategy } from './inference/waveformStrategy';
import { SpectralInferenceStrategy } from './inference/spectralStrategy';
import { WebGPUInferenceStrategy } from './inference/webgpuStrategy';
import type { ExecutionBackend } from '@/types/model';

/**
 * Factory to create the appropriate inference strategy.
 */
function createStrategy(modelInfo: ModelInfo, session: ort.InferenceSession): InferenceStrategy {
    // Check if session is WebGPU enabled to use optimized strategy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionAny = session as any;
    const isWebGPU = sessionAny.handler === 'webgpu' || 
                   (sessionAny.executionProviders && sessionAny.executionProviders.includes('webgpu'));

    switch (modelInfo.type) {
        case ModelType.DEMUCS:
        case ModelType.BS_ROFORMER:
            return new SpectralInferenceStrategy({
                ...modelInfo.config || {},
                useWebGPU: isWebGPU
            });
        case ModelType.MDX:
        default:
            if (isWebGPU) {
                return new WebGPUInferenceStrategy(modelInfo.config || {});
            }
            return new WaveformInferenceStrategy();
    }
}

/**
 * Facade for running inference using the appropriate strategy.
 */
export class InferenceEngine {
    private session: ort.InferenceSession;
    private strategy: InferenceStrategy;
    public backendInfo: { backend: ExecutionBackend; didFallback: boolean } | null = null;

    constructor(session: ort.InferenceSession, modelInfo: ModelInfo) {
        this.session = session;
        this.strategy = createStrategy(modelInfo, session);
    }

    async init() {
        console.log('[inference] Initializing strategy...');
        await this.strategy.initialize(this.session);
        console.log('[inference] Strategy initialized successfully');
    }

    async processChunk(inputData: Float32Array, channels: number, sampleRate: number): Promise<InferenceOutput> {
        return this.strategy.processChunk(this.session, inputData, channels, sampleRate);
    }

    dispose() {
        this.strategy.dispose();
        // Release the ONNX session to free GPU/CPU resources
        try {
            this.session.release();
        } catch (e) {
            console.warn('[InferenceEngine] Failed to release session:', e);
        }
    }
}

/**
 * Processes an array of audio segments.
 * Uses a pipelined approach to maximize throughput.
 */
export async function processAudioInChunks(
    engine: InferenceEngine,
    segments: Float32Array[],
    channels: number,
    sampleRate: number,
    onProgress?: (index: number, total: number) => void,
    onChunkComplete?: (chunk: InferenceOutput, index: number) => void,
    signal?: AbortSignal
): Promise<void> {
    // Pipeline: Track the promise of the last post-processing task
    let previousPostProcessing = Promise.resolve();

    for (let i = 0; i < segments.length; i++) {
        if (signal?.aborted) {
            throw new Error('Processing aborted by user');
        }

        const segment = segments[i];

        if (onProgress) onProgress(i, segments.length);

        // 1. Inference (Heavy GPU/CPU work)
        const result = await engine.processChunk(segment, channels, sampleRate);

        // 2. Post-processing (Reconstruction, postMessage)
        // We do NOT await this before starting the next inference
        if (onChunkComplete) {
            // Wait for previous post-processing to maintain order, 
            // but the loop continues to start the next engine.processChunk
            previousPostProcessing = previousPostProcessing.then(() => {
                onChunkComplete(result, i);
            });
        }
    }

    // Ensure all post-processing is finished before returning
    await previousPostProcessing;
}
