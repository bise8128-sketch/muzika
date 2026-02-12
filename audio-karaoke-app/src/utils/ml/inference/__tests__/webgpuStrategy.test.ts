import { WebGPUInferenceStrategy } from '../webgpuStrategy';
import * as ort from 'onnxruntime-web';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock bufferPool
jest.mock('../../../audio/bufferPool', () => ({
    bufferPool: {
        acquire: jest.fn((len: number) => new Float32Array(len)),
    },
}));

describe('WebGPUInferenceStrategy', () => {
    let strategy: WebGPUInferenceStrategy;

    beforeEach(() => {
        strategy = new WebGPUInferenceStrategy({});
    });

    it('should track and dispose all tensors after processChunk', async () => {
        const disposeSpy = jest.fn();

        // Mock Tensor with dispose tracking
        const originalTensor = ort.Tensor;
        const createdTensors: any[] = [];

        jest.spyOn(ort, 'Tensor').mockImplementation(function (this: any, ...args: any[]) {
            const tensor = new originalTensor(...args);
            (tensor as any).dispose = disposeSpy;
            createdTensors.push(tensor);
            return tensor;
        } as any);

        const sampleRate = 44100;
        const channels = 2;
        const samples = 4410; // 0.1s
        const inputData = new Float32Array(samples * channels);
        for (let i = 0; i < inputData.length; i++) {
            inputData[i] = Math.sin(i * 0.01);
        }

        // Mock session (standard path — no IO binding)
        const mockRun = jest.fn().mockImplementation(async (feeds: Record<string, ort.Tensor>) => {
            const inputTensor = Object.values(feeds)[0];
            const data = inputTensor.data as Float32Array;
            const dims = inputTensor.dims;

            const vocalsTensor = new ort.Tensor('float32', new Float32Array(data), dims);
            const instTensor = new ort.Tensor('float32', new Float32Array(data.length), dims);

            return {
                vocals: vocalsTensor,
                instrumentals: instTensor,
            };
        });

        const mockSession = {
            inputNames: ['input'],
            outputNames: ['vocals', 'instrumentals'],
            run: mockRun,
        } as unknown as ort.InferenceSession;

        // Run processChunk
        const result = await strategy.processChunk(mockSession, inputData, channels, sampleRate);

        // Verify results are valid
        expect(result.vocals).toBeInstanceOf(Float32Array);
        expect(result.instrumentals).toBeInstanceOf(Float32Array);
        expect(result.vocals.length).toBeGreaterThan(0);

        // Verify dispose was called on ALL created tensors (input + 2 outputs = 3)
        // The strategy's finally block calls this.dispose() which clears all tracked tensors
        expect(disposeSpy).toHaveBeenCalledTimes(3);
    });
});
