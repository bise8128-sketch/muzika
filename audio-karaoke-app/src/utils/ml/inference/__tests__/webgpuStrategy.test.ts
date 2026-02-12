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

    afterEach(() => {
        strategy.dispose();
    });

    it('should track and dispose all tensors after processChunk', async () => {
        const sampleRate = 44100;
        const channels = 2;
        const samples = 4410; // 0.1s
        const inputData = new Float32Array(samples * channels);
        for (let i = 0; i < inputData.length; i++) {
            inputData[i] = Math.sin(i * 0.01);
        }

        // Track dispose calls on output tensors
        const outputDisposeCalls: string[] = [];

        const mockRun = jest.fn().mockImplementation(async (feeds: Record<string, ort.Tensor>) => {
            const inputTensor = Object.values(feeds)[0];
            const data = inputTensor.data as Float32Array;
            const dims = inputTensor.dims;

            // Create real tensors and instrument their dispose methods
            const vocalsTensor = new ort.Tensor('float32', new Float32Array(data), dims);
            const originalVocalsDispose = vocalsTensor.dispose?.bind(vocalsTensor);
            (vocalsTensor as any).dispose = () => {
                outputDisposeCalls.push('vocals');
                originalVocalsDispose?.();
            };

            const instTensor = new ort.Tensor('float32', new Float32Array(data.length), dims);
            const originalInstDispose = instTensor.dispose?.bind(instTensor);
            (instTensor as any).dispose = () => {
                outputDisposeCalls.push('instrumentals');
                originalInstDispose?.();
            };

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

        // Run processChunk — the finally block calls this.dispose()
        const result = await strategy.processChunk(mockSession, inputData, channels, sampleRate);

        // Verify results are valid Float32Arrays
        expect(result.vocals).toBeInstanceOf(Float32Array);
        expect(result.instrumentals).toBeInstanceOf(Float32Array);
        expect(result.vocals.length).toBeGreaterThan(0);

        // Verify dispose was called on BOTH output tensors (tracked + disposed in finally)
        expect(outputDisposeCalls).toContain('vocals');
        expect(outputDisposeCalls).toContain('instrumentals');
        expect(outputDisposeCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('should dispose tensors even when processChunk throws', async () => {
        // Spy on the dispose method of the strategy's memory manager
        const disposeSpy = jest.spyOn(strategy as any, 'dispose');

        const mockSession = {
            inputNames: ['input'],
            outputNames: ['vocals', 'instrumentals'],
            run: jest.fn().mockRejectedValue(new Error('Simulated ONNX failure')),
        } as unknown as ort.InferenceSession;

        const inputData = new Float32Array(100);

        await expect(
            strategy.processChunk(mockSession, inputData, 1, 44100)
        ).rejects.toThrow('Simulated ONNX failure');

        // dispose() must be called even on error (from finally block)
        expect(disposeSpy).toHaveBeenCalled();
    });
});
