import * as ort from 'onnxruntime-web';
import type { InferenceOutput } from '@/types/model';
import type { InferenceStrategy } from './types';
import { BaseInferenceStrategy } from './baseStrategy';
import { bufferPool } from '../../audio/bufferPool';

/**
 * Strategy for models that operate on raw waveforms (e.g., standard MDX-Net).
 * Input: [1, channels, samples]
 * Output: Vocals, Instrumentals tensors
 */
export class WaveformInferenceStrategy extends BaseInferenceStrategy implements InferenceStrategy {

    async initialize(session: ort.InferenceSession): Promise<void> {
        // No specific initialization needed for waveform strategy yet
    }

    async processChunk(
        session: ort.InferenceSession,
        inputData: Float32Array,
        channels: number
    ): Promise<InferenceOutput> {
        // Reset memory manager for this chunk
        // Note: We don't dispose previous chunk here, as the caller might handle lifecycle,
        // but usually we want to clear tracked tensors from PREVIOUS run if we reuse strategy.
        // Actually, calling dispose() at the end of processChunk is safer for per-chunk memory hygiene.
        // BUT, if we return results that rely on tracked tensors... wait.
        // bufferPool copies data, so we CAN dispose tensors.

        try {
            const samples = inputData.length / channels;
            const inputShape = [1, channels, samples];

            const inputTensor = new ort.Tensor('float32', inputData, inputShape);
            this.track(inputTensor);

            const feeds: Record<string, ort.Tensor> = {};
            const inputName = session.inputNames[0];
            feeds[inputName] = inputTensor;

            const results = await session.run(feeds);

            // Track outputs
            Object.values(results).forEach(t => this.track(t));

            const outputNames = session.outputNames;
            const vocalsTensor = results[outputNames.find(n => n.includes('vocal')) || outputNames[0]];
            const instrumentalTensor = results[outputNames.find(n => n.includes('inst')) || outputNames[1]];

            if (!vocalsTensor || !instrumentalTensor) {
                throw new Error(`Inference produced incomplete results.`);
            }

            const vocalsData = vocalsTensor.data as Float32Array;
            const instrumentalsData = instrumentalTensor.data as Float32Array;

            // Copy to buffer pool
            const vocalsPooled = bufferPool.acquire(vocalsData.length);
            const instrumentalsPooled = bufferPool.acquire(instrumentalsData.length);

            vocalsPooled.set(vocalsData);
            instrumentalsPooled.set(instrumentalsData);

            return {
                vocals: vocalsPooled,
                instrumentals: instrumentalsPooled,
            };

        } finally {
            this.dispose(); // Clean up GPU tensors immediately after copy
        }
    }
}
