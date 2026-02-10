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

            // Determine input shape based on model metadata if available
            // Default to [1, channels, samples] (3D) which is standard for Demucs/MDX
            let inputShape = [1, channels, samples];

            const inputName = session.inputNames[0];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inputMeta = (session as any).inputMetadata?.[inputName]; // Hack to access metadata

            if (inputMeta && inputMeta.dims) {
                const dims = inputMeta.dims;
                // If model expects 4D input, likely [1, 1, channels, samples] or similar
                if (dims.length === 4) {
                    // Check if it's [Batch, Channels, 1, Time] or [Batch, 1, Channels, Time]
                    // We'll trust the model's requested rank but we need to fit our data
                    inputShape = [1, 1, channels, samples];
                    // If the model expects [1, channels, 1, samples], this might be wrong,
                    // but [1, 1, channels, samples] is the most common 4D variation for audio if 3D is wrapped.
                }
            }

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
