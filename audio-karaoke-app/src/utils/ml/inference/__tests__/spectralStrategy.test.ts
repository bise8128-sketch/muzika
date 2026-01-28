import { SpectralInferenceStrategy } from '../spectralStrategy';
import * as ort from 'onnxruntime-web';

// Mock ONNX Runtime
// We need to allow 'any' cast to mock complex ONNX objects
/* eslint-disable @typescript-eslint/no-explicit-any */

describe('SpectralInferenceStrategy', () => {
    let strategy: SpectralInferenceStrategy;

    beforeEach(() => {
        strategy = new SpectralInferenceStrategy({
            fftSize: 1024,
            hopLength: 256,
        });
    });

    afterEach(() => {
        strategy.dispose();
    });

    it('should process audio through the full pipeline (STFT -> Mock Model -> ISTFT) and reconstruct signal', async () => {
        // 1. Create input signal (Sine wave)
        const sampleRate = 44100;
        const duration = 0.5;
        const inputData = new Float32Array(sampleRate * duration * 2); // Stereo
        for (let i = 0; i < inputData.length / 2; i++) {
            const val = Math.sin(2 * Math.PI * 440 * i / sampleRate);
            inputData[i * 2] = val;     // L
            inputData[i * 2 + 1] = val; // R
        }

        // 2. Mock InferenceSession
        // The mock model will act as a "Pass-through" or "Identity" model.
        // It receives [1, 4, F, T] (L_Re, L_Im, R_Re, R_Im)
        // It should output TWO tensors: Vocals and Instrumentals.
        // We will make Vocals = Input, Instrumentals = Zero.

        const mockRun = jest.fn().mockImplementation(async (feeds: Record<string, ort.Tensor>) => {
            const inputTensor = Object.values(feeds)[0];
            const data = inputTensor.data as Float32Array; // Flattened [1, 4, F, T]
            const dims = inputTensor.dims; // [1, 2, F, T] ?? No strategy constructs [1, 4, F, T]

            // Create output tensors.
            // Vocals = copy of input
            const vocalsData = new Float32Array(data);
            const vocalsTensor = new ort.Tensor('float32', vocalsData, dims);

            // Inst = zeros
            const instData = new Float32Array(data.length);
            const instTensor = new ort.Tensor('float32', instData, dims);

            return {
                'vocals': vocalsTensor,
                'instrumentals': instTensor
            };
        });

        const mockSession = {
            inputNames: ['input'],
            outputNames: ['vocals', 'instrumentals'],
            run: mockRun
        } as unknown as ort.InferenceSession;

        // 3. Run Strategy
        const result = await strategy.processChunk(mockSession, inputData, 2);

        // 4. Verify inputs to mock model
        expect(mockRun).toHaveBeenCalled();
        const callArgs = mockRun.mock.calls[0][0];
        const inputTensor = Object.values(callArgs)[0] as ort.Tensor;
        expect(inputTensor.dims.length).toBe(4);
        expect(inputTensor.dims[1]).toBe(4); // 4 channels (L_re, L_im, R_re, R_im)

        // 5. Verify Outputs
        const vocals = result.vocals;
        const inst = result.instrumentals;

        // Vocals should match input signal (reconstruction)
        expect(vocals.length).toBeGreaterThan(0);

        // Check MSE roughly
        // Alignment might be slightly off due to padding/trimming, but correlation should be high.
        // Or simply check energy.

        // Let's check matching length first (approx)
        // strategy.processChunk uses bufferPool which might be larger, but valid data is implied?
        // Wait, bufferPool returns a subarray? No, it returns the whole pooled buffer usually?
        // Let's check `inference.ts` usage.
        // `vocalsPooled` is `bufferPool.acquire(len)`. `vocalsPooled.set(data)`.
        // It returns the TypedArray which IS the pool slice.

        // Since we slice padding in ISTFT, the length should match the unpadded duration roughly?
        // Actually STFT implementation now pads and creates MORE frames.
        // ISTFT implementation removes padding logic was:
        // `output.slice(padLen, padLen + trimmedLen)`.
        // `trimmedLen = outputLen - 2*padLen`.
        // `outputLen` comes from `numFrames`.
        // If logic is correct, it should be close to input length.

        // Let's check MSE in the middle
        let errorSum = 0;
        const N = Math.min(inputData.length, vocals.length);
        let count = 0;
        for (let i = 1000; i < N - 1000; i++) {
            const diff = inputData[i] - vocals[i];
            errorSum += diff * diff;
            count++;
        }
        const mse = errorSum / count;
        expect(mse).toBeLessThan(0.01); // 1e-2 should be enough for "perfect" reconstruction through float32 STFT/ISTFT

        // Instrumentals should be near zero
        let maxInst = 0;
        for (let i = 0; i < inst.length; i++) {
            maxInst = Math.max(maxInst, Math.abs(inst[i]));
        }
        expect(maxInst).toBeLessThan(1e-7); // Zero tensor -> Zero output
    });
});
