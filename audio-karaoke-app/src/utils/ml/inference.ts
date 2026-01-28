import * as ort from 'onnxruntime-web';
import type { InferenceOutput } from '@/types/model';

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
        // Vocational names vary: "vocals", "out", etc.
        const outputNames = session.outputNames;

        // We expect at least two outputs or one output that we split
        // For Kim_Vocal_2 or similar, it's often 'vocals' and 'instrumental'
        const vocalsTensor = results[outputNames.find(n => n.includes('vocal')) || outputNames[0]];
        const instrumentalTensor = results[outputNames.find(n => n.includes('inst')) || outputNames[1]];

        if (!vocalsTensor || !instrumentalTensor) {
            throw new Error(`Inference produced incomplete results. Expected 2 outputs, got ${Object.keys(results).length}`);
        }

        // Track output tensors for disposal
        memoryManager.track(vocalsTensor);
        memoryManager.track(instrumentalTensor);

        return {
            vocals: vocalsTensor.data as Float32Array,
            instrumentals: instrumentalTensor.data as Float32Array,
        };
    } catch (err) {
        console.error('Inference execution failed:', err);
        throw err;
    } finally {
        // Note: We don't dispose here if we return the raw data views, 
        // but in WebGPU, we MUST dispose the tensors after copying data.
        // If and only if data is copied out, we can dispose.
        // (vocalsTensor.data as Float32Array) usually creates a copy or a view.
        memoryManager.dispose();
    }
}
