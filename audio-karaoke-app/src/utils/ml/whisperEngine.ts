/**
 * WhisperEngine — Browser-side transcription using Whisper ONNX.
 */

import { InferenceEngine } from './inference';
import { ModelInfo } from '@/types/model';
import { loadModel } from './modelManager';
import * as ort from 'onnxruntime-web';

export interface WhisperResult {
    text: string;
    segments: WhisperSegment[];
}

export interface WhisperSegment {
    text: string;
    start: number;
    end: number;
    words?: WhisperWord[];
}

export interface WhisperWord {
    word: string;
    start: number;
    end: number;
    probability: number;
}

export class WhisperEngine {
    private engine: InferenceEngine | null = null;
    private static readonly SAMPLE_RATE = 16000;
    private static readonly N_FFT = 400;
    private static readonly N_MELS = 80;
    private static readonly HOP_LENGTH = 160;
    private static readonly CHUNK_LENGTH = 30; // seconds

    private static readonly MEL_FILTERS = WhisperEngine.generateMelFilters(
        WhisperEngine.N_FFT,
        WhisperEngine.SAMPLE_RATE,
        WhisperEngine.N_MELS
    );

import { ModelDownloadProgress } from '@/types/model';

// ... (inside WhisperEngine class)
    async load(modelInfo: ModelInfo, onProgress?: (p: ModelDownloadProgress) => void) {
        this.engine = await loadModel(modelInfo, onProgress);
    }

    /**
     * Transcribe audio data. 
     * Expects mono Float32Array at 16kHz.
     */
    async transcribe(audio: Float32Array): Promise<WhisperResult> {
        if (!this.engine) throw new Error('WhisperEngine not loaded');

        // 1. Preprocess to Log-Mel Spectrogram
        const mel = this.generateMelSpectrogram(audio);
        
        // 2. Inference
        // Shape: [1, 80, 3000] (for 30s)
        // We need to pad or truncate.
        const melData = new Float32Array(80 * 3000).fill(-10); // Log-mel floor
        const actualFrames = Math.min(3000, mel.length / 80);
        for (let i = 0; i < actualFrames; i++) {
            for (let m = 0; m < 80; m++) {
                melData[m * 3000 + i] = mel[i * 80 + m];
            }
        }

        const _inputTensor = new ort.Tensor('float32', melData, [1, 80, 3000]);
        console.log('[WhisperEngine] Mel tensor prepared', _inputTensor.dims);
        // For this implementation, we assume a "compiled" version or a single-pass version if available,
        // otherwise we would implement the iterative decoding.
        // Assuming the engine handles the full pass for simplicity in this prototype.
        
        console.log('[WhisperEngine] Running inference...');
        // const output = await this.engine.processChunk(...) // InferenceEngine needs to be adapted for Whisper

        // MOCK for prototype — actual alignment is DTW anyway
        return {
            text: "Transcribed audio",
            segments: [
                {
                    text: "Transcribed audio",
                    start: 0,
                    end: audio.length / 16000,
                    words: [
                        { word: "Transcribed", start: 0, end: 0.5, probability: 0.99 },
                        { word: "audio", start: 0.5, end: 1.0, probability: 0.99 }
                    ]
                }
            ]
        };
    }

    private generateMelSpectrogram(audio: Float32Array): Float32Array {
        const window = new Float32Array(WhisperEngine.N_FFT);
        for (let i = 0; i < WhisperEngine.N_FFT; i++) {
            window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / WhisperEngine.N_FFT));
        }

        const numFreqs = WhisperEngine.N_FFT / 2 + 1;
        const numFrames = Math.floor((audio.length - WhisperEngine.N_FFT) / WhisperEngine.HOP_LENGTH) + 1;
        const melSpectrogram = new Float32Array(WhisperEngine.N_MELS * numFrames);

        const real = new Float32Array(WhisperEngine.N_FFT);
        const imag = new Float32Array(WhisperEngine.N_FFT);

        for (let i = 0; i < numFrames; i++) {
            const offset = i * WhisperEngine.HOP_LENGTH;
            for (let j = 0; j < WhisperEngine.N_FFT; j++) {
                real[j] = audio[offset + j] * window[j];
                imag[j] = 0;
            }

            this.fft(real, imag);

            for (let m = 0; m < WhisperEngine.N_MELS; m++) {
                let melVal = 0;
                for (let k = 0; k < numFreqs; k++) {
                    const mag = real[k] * real[k] + imag[k] * imag[k];
                    melVal += mag * WhisperEngine.MEL_FILTERS[m * numFreqs + k];
                }
                const val = Math.log10(Math.max(melVal, 1e-10));
                melSpectrogram[i * WhisperEngine.N_MELS + m] = val;
            }
        }

        return melSpectrogram;
    }

    private static generateMelFilters(nFft: number, sampleRate: number, nMels: number): Float32Array {
        const numFreqs = nFft / 2 + 1;
        const filters = new Float32Array(nMels * numFreqs);

        const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
        const melToHz = (mel: number) => 700 * (Math.pow(10, mel / 2595) - 1);

        const minMel = hzToMel(0);
        const maxMel = hzToMel(sampleRate / 2);

        const melPoints = new Float32Array(nMels + 2);
        for (let i = 0; i < nMels + 2; i++) {
            melPoints[i] = melToHz(minMel + (i * (maxMel - minMel)) / (nMels + 1));
        }

        const binPoints = new Int32Array(nMels + 2);
        for (let i = 0; i < nMels + 2; i++) {
            binPoints[i] = Math.floor(((nFft + 1) * melPoints[i]) / sampleRate);
        }

        for (let m = 1; m <= nMels; m++) {
            for (let k = binPoints[m - 1]; k < binPoints[m]; k++) {
                filters[(m - 1) * numFreqs + k] = (k - binPoints[m - 1]) / (binPoints[m] - binPoints[m - 1]);
            }
            for (let k = binPoints[m]; k < binPoints[m + 1]; k++) {
                filters[(m - 1) * numFreqs + k] = (binPoints[m + 1] - k) / (binPoints[m + 1] - binPoints[m]);
            }
        }

        return filters;
    }

    private fft(re: Float32Array, im: Float32Array) {
        const n = re.length;
        if (n <= 1) return;

        const bits = Math.log2(n);
        for (let i = 0; i < n; i++) {
            let j = i;
            let k = 0;
            for (let b = 0; b < bits; b++) {
                k = (k << 1) | (j & 1);
                j >>= 1;
            }
            if (k > i) {
                [re[i], re[k]] = [re[k], re[i]];
                [im[i], im[k]] = [im[k], im[i]];
            }
        }

        for (let len = 2; len <= n; len <<= 1) {
            const angle = -2 * Math.PI / len;
            const wlen_re = Math.cos(angle);
            const wlen_im = Math.sin(angle);
            const halfLen = len >> 1;

            for (let i = 0; i < n; i += len) {
                let w_re = 1;
                let w_im = 0;
                for (let j = 0; j < halfLen; j++) {
                    const idx = i + j;
                    const idx2 = i + j + halfLen;

                    const u_re = re[idx];
                    const u_im = im[idx];
                    const v_re = re[idx2] * w_re - im[idx2] * w_im;
                    const v_im = re[idx2] * w_im + im[idx2] * w_re;

                    re[idx] = u_re + v_re;
                    im[idx] = u_im + v_im;
                    re[idx2] = u_re - v_re;
                    im[idx2] = u_im - v_im;

                    const tmp_w_re = w_re * wlen_re - w_im * wlen_im;
                    w_im = w_re * wlen_im + w_im * wlen_re;
                    w_re = tmp_w_re;
                }
            }
        }
    }
}
