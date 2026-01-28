import * as ort from 'onnxruntime-web';

/**
 * Manages GPU memory by tracking and disposing of tensors.
 */
export class GPUMemoryManager {
    private activeTensors: Set<ort.Tensor> = new Set();

    track(tensor: ort.Tensor): ort.Tensor {
        this.activeTensors.add(tensor);
        return tensor;
    }

    dispose(): void {
        this.activeTensors.forEach(tensor => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (tensor as any).dispose?.();
            } catch (e) {
                // Ignore
            }
        });
        this.activeTensors.clear();
    }
}

export abstract class BaseInferenceStrategy {
    protected memoryManager: GPUMemoryManager;

    constructor() {
        this.memoryManager = new GPUMemoryManager();
    }

    protected track(tensor: ort.Tensor): ort.Tensor {
        return this.memoryManager.track(tensor);
    }

    dispose(): void {
        this.memoryManager.dispose();
    }
}
