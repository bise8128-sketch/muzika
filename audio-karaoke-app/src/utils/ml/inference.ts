import * as ort from 'onnxruntime-web';
import type { InferenceOutput } from '@/types/model';
import { bufferPool } from '../audio/bufferPool';

/**
 * Manages GPU memory by tracking and disposing of tensors.
 */
export class GPUMemoryManager {
    private activeTensors: Set<ort.Tensor> = new Set();

    /**
     * Tracks a tensor for later disposal.
     */
    track(tensor: ort.Tensor): ort.Tensor {
        this.activeTensors.add(tensor);
        return tensor;
    }

    /**
     * Disposes of all tracked tensors to prevent memory leaks.
     */
    dispose(): void {
        this.activeTensors.forEach(tensor => {
            // InferenceSession output tensors should be disposed explicitly in WebGPU
            try {
                (tensor as any).dispose?.();
            } catch (e) {
                // Silently fail if dispose is not available or fails
            }
        });
        this.activeTensors.clear();
    }
}

/**
 * Runs inference on a single audio chunk.
 * 
 * @param session The ONNX InferenceSession
 * @param inputData Float32Array of audio data (expected shape: [channels, samples])
 * @param channels Number of audio channels (usually 2)
 * @param samples Number of samples in the chunk
 */
export async function runInference(
    session: ort.InferenceSession,
    inputData: Float32Array,
    channels: number,
    samples: number
): Promise<InferenceOutput> {
    const memoryManager = new GPUMemoryManager();

    try {
        // Create input tensor [1, channels, samples] or as required by model
        // Note: This shape might need adjustment based on the specific MDX-Net model used.
        // Standard MDX models often use [1, 2, duration * sample_rate]
        const inputShape = [1, channels, samples];
        const inputTensor = new ort.Tensor('float32', inputData, inputShape);
        memoryManager.track(inputTensor);

        const feeds: Record<string, ort.Tensor> = {};
        // Assumes input node name is "input", common in MDX models
        const inputName = session.inputNames[0];
        feeds[inputName] = inputTensor;

        // Run inference
        const results = await session.run(feeds);

        // Extract outputs. Assumes standard vocal/instrumental output names or first two outputs.
        const outputNames = session.outputNames;

        const vocalsTensor = results[outputNames.find(n => n.includes('vocal')) || outputNames[0]];
        const instrumentalTensor = results[outputNames.find(n => n.includes('inst')) || outputNames[1]];

        if (!vocalsTensor || !instrumentalTensor) {
            throw new Error(`Inference produced incomplete results. Expected 2 outputs, got ${Object.keys(results).length}`);
        }

        // Track output tensors for disposal
        memoryManager.track(vocalsTensor);
        memoryManager.track(instrumentalTensor);

        // Copy data to pooled buffers to ensure we can dispose of the tensors immediately
        const vocalsData = vocalsTensor.data as Float32Array;
        const instrumentalsData = instrumentalTensor.data as Float32Array;

        const vocalsPooled = bufferPool.acquire(vocalsData.length);
        const instrumentalsPooled = bufferPool.acquire(instrumentalsData.length);

        vocalsPooled.set(vocalsData);
        instrumentalsPooled.set(instrumentalsData);

        return {
            vocals: vocalsPooled,
            instrumentals: instrumentalsPooled,
        };
    } catch (err) {
        console.error('Inference execution failed:', err);
        throw err;
    } finally {
        // Dispose of all tracked tensors (including session outputs)
        memoryManager.dispose();
    }
}

/**
 * Processes an array of audio segments sequentially.
 * Used for batch processing long audio files.
 * 
 * @param session The ONNX InferenceSession
 * @param segments Array of Float32Array segments
 * @param channels Number of audio channels (usually 2)
 * @param onProgress Callback for progress tracking
 */
export async function processAudioInChunks(
    session: ort.InferenceSession,
    segments: Float32Array[],
    channels: number,
    onProgress?: (index: number, total: number) => void
): Promise<InferenceOutput[]> {
    const results: InferenceOutput[] = [];

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const samples = segment.length / channels;

        if (onProgress) onProgress(i, segments.length);

        const result = await runInference(session, segment, channels, samples);
        results.push(result);
    }

    return results;
}
