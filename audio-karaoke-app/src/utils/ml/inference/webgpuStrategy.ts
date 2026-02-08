import * as ort from 'onnxruntime-web';
import { BaseInferenceStrategy } from './baseStrategy';
import type { InferenceStrategy } from './types';
import type { InferenceOutput, ModelConfig } from '@/types/model';
import { bufferPool } from '../../audio/bufferPool';

export class WebGPUInferenceStrategy extends BaseInferenceStrategy implements InferenceStrategy {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private ioBinding: any | null = null;
    private config: ModelConfig;
    private runOptions: Record<string, unknown>;

    constructor(config: ModelConfig) {
        super();
        this.config = config;
        this.runOptions = {};
    }

    async initialize(session: ort.InferenceSession): Promise<void> {
        console.log('[WebGPUInferenceStrategy] Initializing...');

        // Check for WebGPU backend support in the session object (runtime check)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sess = session as any;

        // Try to create IO Binding if supported
        if (typeof sess.createIoBinding === 'function') {
            try {
                this.ioBinding = sess.createIoBinding();
                console.log('[WebGPUInferenceStrategy] IO Binding created successfully.');
            } catch (e) {
                console.warn('[WebGPUInferenceStrategy] Failed to create IO Binding:', e);
            }
        } else {
            console.warn('[WebGPUInferenceStrategy] createIoBinding not available on session.');
        }
    }

    async processChunk(
        session: ort.InferenceSession,
        inputData: Float32Array,
        channels: number,
        sampleRate: number
    ): Promise<InferenceOutput> {
        const inputName = session.inputNames[0];
        const outputNames = session.outputNames;
        const samples = inputData.length / channels;
        const inputShape = [1, channels, samples]; // Assuming [Batch, Channels, Time]

        // De-interleave input to planar format
        // This is CPU side work, unfortunately unavoidable unless input comes from GPU
        const planarData = new Float32Array(inputData.length);
        for (let c = 0; c < channels; c++) {
            for (let s = 0; s < samples; s++) {
                planarData[c * samples + s] = inputData[s * channels + c];
            }
        }

        let results: Record<string, ort.Tensor>;

        try {
            if (this.ioBinding) {
                // --- IO Binding Path ---

                // 1. Bind Input
                const inputTensor = new ort.Tensor('float32', planarData, inputShape);
                this.ioBinding.bindInput(inputName, inputTensor);

                // 2. Bind Outputs
                // We let ORT allocate outputs on device for now, unless we want to pre-allocate
                // binding 'location' is not fully exposed in JS API yet cleanly for all outputs
                // so we rely on bindOutput with name.
                outputNames.forEach(name => {
                    this.ioBinding.bindOutput(name, 'cpu'); // Bind to CPU to get data back easily for now
                    // Ideally we bind to 'device' and keep it there, but we need to return Float32Array
                    // so we would need to copyToCpu anyway.
                    // To strictly maintain residence, we would return the tensor handle.
                    // But InferenceOutput expects Float32Array. 
                    // So we do the copy at the very end.
                });

                // 3. Execute
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (session as any).run(null, this.ioBinding, this.runOptions);

                // 4. Get Outputs
                // outputs are in the bound buffers.
                // If we bound to CPU, they are copied.
                // If we bound to device, we need to copy them.
                // For this implementation, let's assume we retrieve them via getOutputValues
                results = this.ioBinding.getOutputValues();

                // Clear bindings for next run if shapes change? 
                // If using graph capture/static shapes, we keep them.
                // But here we are essentially re-binding every time because inputData is new.
                // Optimization: If input buffer is same size, we could update it? 
                // JS Tensor holds new data reference.
                this.ioBinding.clearBoundInputs();
                this.ioBinding.clearBoundOutputs();

            } else {
                // --- Standard Path ---
                const inputTensor = new ort.Tensor('float32', planarData, inputShape);
                const feeds = { [inputName]: inputTensor };
                results = await session.run(feeds, this.runOptions);
            }

            // Extract Vocals and Instrumentals
            // Map output names to expected keys
            // Typically: 'vocals', 'drums', 'bass', 'other' OR just 'output' split
            // If explicit names exist:
            let vocalsTensor = results[outputNames.find(n => n.toLowerCase().includes('vocal')) || ''];
            let instrumentalTensor = results[outputNames.find(n => n.toLowerCase().includes('inst')) || ''];

            // Fallback for models with single output (e.g. [Batch, 2, Time] or [Batch, 4, Time])
            if (!vocalsTensor && !instrumentalTensor && outputNames.length === 1) {
                const combined = results[outputNames[0]];
                // We would need to split this tensor.
                // For now, assume model outputs separate tensors as per typical Demucs ONNX exports used here.
                // If not, we might fail or need logic to split.
                throw new Error('Single output splitting not implemented in WebGPU strategy yet');
            }

            if (!vocalsTensor) vocalsTensor = results[outputNames[0]]; // Fallback
            if (!instrumentalTensor) instrumentalTensor = results[outputNames[1]] || vocalsTensor; // Fallback

            // Helper to process output tensor to interleaved Float32Array
            const processOutput = (tensor: ort.Tensor) => {
                const data = tensor.data as Float32Array;
                const outSamples = data.length / channels; // Assuming output has same channel count as input logic
                // If model is [Batch, Channels, Time]
                const interleaved = new Float32Array(data.length);
                for (let s = 0; s < outSamples; s++) {
                    for (let c = 0; c < channels; c++) {
                        interleaved[s * channels + c] = data[c * outSamples + s];
                    }
                }
                return interleaved;
            };

            const vocalsData = processOutput(vocalsTensor);
            const instData = processOutput(instrumentalTensor);

            // Use buffer pool for memory efficiency
            const vocals = bufferPool.acquire(vocalsData.length);
            vocals.set(vocalsData);

            const instrumentals = bufferPool.acquire(instData.length);
            instrumentals.set(instData);

            return {
                vocals,
                instrumentals
            };

        } catch (e) {
            console.error('[WebGPUInferenceStrategy] Processing failed:', e);
            throw e;
        }
    }

    dispose(): void {
        super.dispose();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (this.ioBinding && (this.ioBinding as any).release) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.ioBinding as any).release();
        }
        this.ioBinding = null;
    }
}
