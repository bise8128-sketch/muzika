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

    constructor(config: ModelConfig) {
        super();
        const fftSize = config.fftSize || 4096;
        const hopLength = config.hopLength || 1024;
        this.stft = new STFT(fftSize, hopLength);
        this.istft = new ISTFT(fftSize, hopLength);
    }

    async initialize(session: ort.InferenceSession): Promise<void> {
        // Prepare any specific resources
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

            const { dims } = stftL;
            const [numFrames, numFreqs] = dims; // [Time, Freq] from our STFT

            // Construct input tensor [1, 4, Freq, Frames] (or [1, 4, Frames, Freq]?)
            // PyTorch default is often [B, C, F, T].
            // Our STFT output is flat row-major [Frame 0, Frame 1...]. 
            // We need to construct the tensor data correctly.

            const tensorSize = 4 * numFreqs * numFrames;
            const floatData = new Float32Array(tensorSize);

            // Fill data: Channel 0 (L_Real), 1 (L_Imag), 2 (R_Real), 3 (R_Imag)
            // Or interleaved? Usually planar for ONNX/PyTorch.

            // STFT output is Magnitude/Phase. We need Real/Imag.
            // R = Mag * cos(Ph), I = Mag * sin(Ph)

            const fillPlane = (offset: number, mag: Float32Array, ph: Float32Array, isImag: boolean) => {
                const planeStride = numFreqs * numFrames;
                for (let i = 0; i < planeStride; i++) {
                    const r = mag[i] * Math.cos(ph[i]);
                    const im = mag[i] * Math.sin(ph[i]);
                    floatData[offset * planeStride + i] = isImag ? im : r;
                }
            };

            // 4 Channels: L_Re, L_Im, R_Re, R_Im
            fillPlane(0, stftL.magnitude, stftL.phase, false);
            fillPlane(1, stftL.magnitude, stftL.phase, true);
            fillPlane(2, stftR.magnitude, stftR.phase, false);
            fillPlane(3, stftR.magnitude, stftR.phase, true);

            // Shape: [1, 4, Freq, Frames]? OR [1, 4, Frames, Freq]?
            // STFT 'dims' is [Frames, Freq].
            // If model expects [B, C, F, T], we need to transpose our STFT data if it's [T, F].
            // Our STFT is flat [T, F]. Frame 0 is first.
            // So floatData is currently [Plane 0 (T, F), Plane 1...].
            // We might need to transpose to [F, T] logic if model expects Freq dim first.
            // Let's assume [B, 4, F, T] for now, requiring transpose of our T-major data.

            // Transpose helper
            const transposeAndFill = (planeIdx: number, mag: Float32Array, ph: Float32Array, isImag: boolean) => {
                const planeOffset = planeIdx * (numFreqs * numFrames);
                for (let f = 0; f < numFreqs; f++) {
                    for (let t = 0; t < numFrames; t++) {
                        // Src index (Time-major): t * numFreqs + f
                        const srcIdx = t * numFreqs + f;
                        // Dst index (Freq-major): f * numFrames + t (within the plane)
                        const dstIdx = f * numFrames + t;

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

            const shape = [1, 4, numFreqs, numFrames];
            const inputTensor = new ort.Tensor('float32', floatData, shape);
            this.track(inputTensor);

            // 3. Inference
            const feeds = { [session.inputNames[0]]: inputTensor };
            const results = await session.run(feeds);
            Object.values(results).forEach(t => this.track(t));

            // 4. Extract Output
            // Expected: [1, 4, Freq, Frames] (Vocals) ? Or just 1 output with 4 sources?
            // Assuming 2 specific outputs for Vocals/Inst like MDX.
            const outputNames = session.outputNames;
            // Similar logic to Waveform: find 'vocal' output
            const vocalsTensor = results[outputNames.find(n => n.includes('vocal')) || outputNames[0]];
            const instTensor = results[outputNames.find(n => n.includes('inst')) || outputNames[1]];

            if (!vocalsTensor || !instTensor) {
                // If single output (all sources), we'd need to slice.
                throw new Error(`Inference produced incomplete results.`);
            }

            // 5. ISTFT Reconstruct
            // Function to reconstruct from Tensor [1, 4, F, T] (Stereo Complex)
            const reconstruct = (tensor: ort.Tensor) => {
                const data = tensor.data as Float32Array;
                // De-transpose from [F, T] back to [T, F] for our ISTFT
                // And separate L/R

                // data layout: [L_Re, L_Im, R_Re, R_Im] planes
                const planeSize = numFreqs * numFrames;

                const getPlane = (idx: number) => data.subarray(idx * planeSize, (idx + 1) * planeSize);

                // Helper to de-transpose and convert to Mag/Phase
                const toPolar = (realPlane: Float32Array, imagPlane: Float32Array) => {
                    const mag = new Float32Array(planeSize);
                    const ph = new Float32Array(planeSize);

                    for (let f = 0; f < numFreqs; f++) {
                        for (let t = 0; t < numFrames; t++) {
                            // Src: F-major (f * numFrames + t)
                            const srcIdx = f * numFrames + t;
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
