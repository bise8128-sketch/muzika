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
            const inputShape = [1, 1, channels, samples];

            // De-interleave to planar for ONNX
            const planarData = new Float32Array(inputData.length);
            for (let c = 0; c < channels; c++) {
                for (let s = 0; s < samples; s++) {
                    planarData[c * samples + s] = inputData[s * channels + c];
                }
            }

            const inputTensor = new ort.Tensor('float32', planarData, inputShape);
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

            // Function to interleave planar output
            const interleave = (tensor: ort.Tensor) => {
                const data = tensor.data as Float32Array;
                const interleaved = new Float32Array(data.length);
                const samplesPerChannel = data.length / channels;
                for (let s = 0; s < samplesPerChannel; s++) {
                    for (let c = 0; c < channels; c++) {
                        interleaved[s * channels + c] = data[c * samplesPerChannel + s];
                    }
                }
                return interleaved;
            };

            const vocalsInterleaved = interleave(vocalsTensor);
            const instrumentalsInterleaved = interleave(instrumentalTensor);

            // Copy to buffer pool
            const vocalsPooled = bufferPool.acquire(vocalsInterleaved.length);
            const instrumentalsPooled = bufferPool.acquire(instrumentalsInterleaved.length);

            vocalsPooled.set(vocalsInterleaved);
            instrumentalsPooled.set(instrumentalsInterleaved);

            return {
                vocals: vocalsPooled,
                instrumentals: instrumentalsPooled,
            };

        } finally {
            this.dispose(); // Clean up GPU tensors immediately after copy
        }
    }
}
