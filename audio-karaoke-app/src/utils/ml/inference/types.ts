import * as ort from 'onnxruntime-web';
import type { InferenceOutput } from '@/types/model';

export interface InferenceStrategy {
    /**
     * Prepares the session options or memory allocations if needed.
     */
    initialize(session: ort.InferenceSession): Promise<void>;

    /**
     * Processes a single audio chunk through the model.
     * Handles pre-processing (e.g. STFT), inference, and post-processing (e.g. ISTFT).
     */
    processChunk(
        session: ort.InferenceSession,
        inputData: Float32Array,
        channels: number,
        sampleRate: number
    ): Promise<InferenceOutput>;

    /**
     * Cleans up resources.
     */
    dispose(): void;
}
