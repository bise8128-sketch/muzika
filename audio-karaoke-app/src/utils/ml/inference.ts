import * as ort from 'onnxruntime-web';
import type { InferenceOutput, ModelInfo } from '@/types/model';
import { ModelType } from '@/types/model';
import type { InferenceStrategy } from './inference/types';
import { WaveformInferenceStrategy } from './inference/waveformStrategy';
import { SpectralInferenceStrategy } from './inference/spectralStrategy';

/**
 * Factory to create the appropriate inference strategy.
 */
function createStrategy(modelInfo: ModelInfo): InferenceStrategy {
    switch (modelInfo.type) {
        case ModelType.DEMUCS:
        case ModelType.BS_ROFORMER:
            return new SpectralInferenceStrategy(modelInfo.config || {});
        case ModelType.MDX:
        default:
            return new WaveformInferenceStrategy();
    }
}

/**
 * Facade for running inference using the appropriate strategy.
 */
export class InferenceEngine {
    private session: ort.InferenceSession;
    private strategy: InferenceStrategy;

    constructor(session: ort.InferenceSession, modelInfo: ModelInfo) {
        this.session = session;
        this.strategy = createStrategy(modelInfo);
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
