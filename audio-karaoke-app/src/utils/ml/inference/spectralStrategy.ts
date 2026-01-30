import * as ort from 'onnxruntime-web';
import type { InferenceOutput, ModelConfig } from '@/types/model';
import type { InferenceStrategy } from './types';
import { BaseInferenceStrategy } from './baseStrategy';
import { STFT, ISTFT } from '../../audio/stft';
import { bufferPool } from '../../audio/bufferPool';

/**
 * Strategy for models that operate on Spectrograms (e.g., Demucs, BS-RoFormer).
 * Input: STFT([1, channels, samples]) -> Complex Spectrogram
 * Output: Separated Complex Spectrograms -> ISTFT -> Audio
 */
export class SpectralInferenceStrategy extends BaseInferenceStrategy implements InferenceStrategy {
    private stft: STFT;
    private istft: ISTFT;
    private config: ModelConfig;

    constructor(config: ModelConfig) {
        super();
        this.config = config;
        const fftSize = config.fftSize || 4096;
        const hopLength = config.hopLength || 1024;
        this.stft = new STFT(fftSize, hopLength);
        this.istft = new ISTFT(fftSize, hopLength);
    }

    async initialize(session: ort.InferenceSession): Promise<void> {
        console.log('[SpectralInferenceStrategy] Initializing with session...');
        // Inspect input metadata to adjust targetFreqs and targetFrames if possible
        const inputName = session.inputNames[0];
        const inputMeta = session.inputNames.length > 0 ? (session as any).inputMetadata?.[inputName] : null;

        if (inputMeta && inputMeta.dims) {
            console.log(`[SpectralInferenceStrategy] Detected input dimensions: ${JSON.stringify(inputMeta.dims)}`);
            // Typically [Batch, Channels, Freq, Time]
            const freqDim = inputMeta.dims[2];
            const timeDim = inputMeta.dims[3];

            if (typeof freqDim === 'number' && freqDim > 0) {
                (this.config as any).targetFreqs = freqDim;

                // If freqDim is different from expected, we might need to adjust fftSize
                const expectedFftSize = (freqDim - 1) * 2;
                if (expectedFftSize !== this.stft.getFftSize()) {
                    console.log(`[SpectralInferenceStrategy] Re-initializing STFT with fftSize: ${expectedFftSize}`);
                    this.stft = new STFT(expectedFftSize, this.config.hopLength || 1024);
                    this.istft = new ISTFT(expectedFftSize, this.config.hopLength || 1024);
                }
            }
            if (typeof timeDim === 'number' && timeDim > 0) {
                (this.config as any).targetFrames = timeDim;
            }
        }
    }

    async processChunk(
        session: ort.InferenceSession,
        inputData: Float32Array,
        channels: number
    ): Promise<InferenceOutput> {
        try {
            // 1. STFT
            // Note: inputData is interleaved [L, R, L, R...]
            // We need to de-interleave for STFT if channels > 1
            const left = new Float32Array(inputData.length / channels);
            const right = new Float32Array(inputData.length / channels);

            for (let i = 0; i < left.length; i++) {
                left[i] = inputData[i * 2];
                right[i] = inputData[i * 2 + 1];
            }

            // Process each channel
            const stftL = this.stft.process(left);
            const stftR = this.stft.process(right);

            // 2. Prepare Tensors
            // Demucs typically expects a complex tensor representation.
            // Standard approach: Concatenate real and imaginary parts as channels?
            // Input shape usually: [Batch, Channels, Freq, Time] vs [Batch, Freq, Time]
            // For Demucs v4: Input is [Batch, Channels, Time] (Waveform) - WAIT.
            // Demucs v4 IS a waveform model usually (Convolutional on waveform or Hybrid).
            // BUT Hybrid Demucs uses STFT internally or externally.
            // If the ONNX export DOES NOT include STFT, we must provide spectrogram.
            // Assuming we are supporting the "Spectrogram input" version as per research for ONNX Demucs.

            // Let's assume the model expects: [Batch, Channels * 2 (Real/Imag), Freq, Frames]
            // Channels = 2 (Stereo) -> 4 feature maps.

            const { dims: stftDims } = stftL;
            const [numFrames, numFreqs] = stftDims; // [Time, Freq] from our STFT

            // Handle fixed shapes for models like MDX HQ3
            // These can be passed in ModelConfig or use defaults for HQ3
            const targetFreqs = (this.config as any).targetFreqs || 3072;
            const targetFrames = (this.config as any).targetFrames || 256;

            const tensorSize = 4 * targetFreqs * targetFrames;
            const floatData = new Float32Array(tensorSize);

            // Transpose helper with cropping/padding to fixed size
            const transposeAndFill = (planeIdx: number, mag: Float32Array, ph: Float32Array, isImag: boolean) => {
                const planeOffset = planeIdx * (targetFreqs * targetFrames);
                for (let f = 0; f < targetFreqs; f++) {
                    for (let t = 0; t < targetFrames; t++) {
                        // Skip if out of bounds (padding with 0)
                        if (f >= numFreqs || t >= numFrames) continue;

                        // Src index (Time-major): t * numFreqs + f
                        const srcIdx = t * numFreqs + f;
                        // Dst index (Freq-major): f * targetFrames + t (within the plane)
                        const dstIdx = f * targetFrames + t;

                        const val = isImag
                            ? mag[srcIdx] * Math.sin(ph[srcIdx])
                            : mag[srcIdx] * Math.cos(ph[srcIdx]);

                        floatData[planeOffset + dstIdx] = val;
                    }
                }
            };

            transposeAndFill(0, stftL.magnitude, stftL.phase, false);
            transposeAndFill(1, stftL.magnitude, stftL.phase, true);
            transposeAndFill(2, stftR.magnitude, stftR.phase, false);
            transposeAndFill(3, stftR.magnitude, stftR.phase, true);

            const shape = [1, 4, targetFreqs, targetFrames];
            const inputTensor = new ort.Tensor('float32', floatData, shape);
            this.track(inputTensor);

            // 3. Inference
            const feeds = { [session.inputNames[0]]: inputTensor };
            const results = await session.run(feeds);
            Object.values(results).forEach(t => this.track(t));

            // 4. Extract Output
            const outputNames = session.outputNames;
            console.log('[SpectralInferenceStrategy] Model output names:', outputNames);

            // Robust output mapping
            let vocalsTensor: ort.Tensor | undefined;
            let instTensor: ort.Tensor | undefined;

            // Try to find by name
            const vocalName = outputNames.find(n => n.toLowerCase().includes('vocal'));
            const instName = outputNames.find(n => n.toLowerCase().includes('inst') || n.toLowerCase().includes('acc'));

            if (vocalName) vocalsTensor = results[vocalName];
            if (instName) instTensor = results[instName];

            // If still missing, and we have 2 outputs, assume first is target and second is remaining?
            if (outputNames.length >= 2) {
                if (!vocalsTensor) vocalsTensor = results[outputNames[0]];
                if (!instTensor) instTensor = results[outputNames[1]];
            } else if (outputNames.length === 1) {
                const singleTensor = results[outputNames[0]];
                if (outputNames[0].toLowerCase().includes('inst')) {
                    instTensor = singleTensor;
                } else {
                    vocalsTensor = singleTensor;
                }
            }

            if (!vocalsTensor && !instTensor) {
                throw new Error(`Inference produced no compatible results. Outputs: ${outputNames.join(', ')}`);
            }

            // 5. ISTFT Reconstruct
            // Function to reconstruct from Tensor [1, 4, F, T] (Stereo Complex)
            const reconstruct = (tensor: ort.Tensor | undefined) => {
                if (!tensor) {
                    // Return silence if tensor is missing
                    return new Float32Array(numFrames * this.config.hopLength! * 2);
                }
                const data = tensor.data as Float32Array;
                // De-transpose from [F, T] back to [T, F] for our ISTFT
                // And separate L/R

                // data layout: [L_Re, L_Im, R_Re, R_Im] planes
                const planeSize = targetFreqs * targetFrames;

                const getPlane = (idx: number) => data.subarray(idx * planeSize, (idx + 1) * planeSize);

                // Helper to de-transpose and convert to Mag/Phase
                const toPolar = (realPlane: Float32Array, imagPlane: Float32Array) => {
                    const mag = new Float32Array(numFreqs * numFrames);
                    const ph = new Float32Array(numFreqs * numFrames);

                    for (let f = 0; f < targetFreqs; f++) {
                        for (let t = 0; t < targetFrames; t++) {
                            // Skip if outside our original STFT bounds
                            if (f >= numFreqs || t >= numFrames) continue;

                            // Src: F-major (f * targetFrames + t)
                            const srcIdx = f * targetFrames + t;
                            // Dst: T-major (t * numFreqs + f)
                            const dstIdx = t * numFreqs + f;

                            const r = realPlane[srcIdx];
                            const i = imagPlane[srcIdx];

                            mag[dstIdx] = Math.sqrt(r * r + i * i);
                            ph[dstIdx] = Math.atan2(i, r);
                        }
                    }
                    return { magnitude: mag, phase: ph };
                };

                const L = toPolar(getPlane(0), getPlane(1));
                const R = toPolar(getPlane(2), getPlane(3));

                const leftAudio = this.istft.process(L.magnitude, L.phase, [numFrames, numFreqs]);
                const rightAudio = this.istft.process(R.magnitude, R.phase, [numFrames, numFreqs]);

                // Interleave
                const interleaved = new Float32Array(leftAudio.length * 2);
                for (let i = 0; i < leftAudio.length; i++) {
                    interleaved[i * 2] = leftAudio[i];
                    interleaved[i * 2 + 1] = rightAudio[i];
                }
                return interleaved;
            };

            const vocalsAudio = reconstruct(vocalsTensor);
            const instAudio = reconstruct(instTensor);

            // Copy to buffer pool
            const vocalsPooled = bufferPool.acquire(vocalsAudio.length);
            const instPooled = bufferPool.acquire(instAudio.length);

            vocalsPooled.set(vocalsAudio);
            instPooled.set(instAudio);

            return {
                vocals: vocalsPooled,
                instrumentals: instPooled
            };

        } finally {
            this.dispose();
        }
    }
}
