/**
 * Spectral processing utilities for audio source separation models.
 * Implements Short-Time Fourier Transform (STFT) and Inverse STFT (ISTFT).
 */

export class STFT {
    private fftSize: number;
    private hopLength: number;
    private window: Float32Array;

    constructor(fftSize: number = 4096, hopLength: number = 1024) {
        this.fftSize = fftSize;
        this.hopLength = hopLength;
        this.window = this.createHannWindow(fftSize);
    }

    private createHannWindow(size: number): Float32Array {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size));
        }
        return window;
    }

    /**
     * Performs STFT on the input signal.
     * Automatically applies padding (reflection to start, zero/reflection to end) to ensure full signal coverage.
     */
    process(signal: Float32Array): { magnitude: Float32Array; phase: Float32Array; dims: [number, number] } {
        // 1. Determine number of frames needed to fully cover the signal
        // We want the windows to slide over the entire signal.
        // Including the first window centered at start (offset by fftSize/2 usually)
        // With padLen = fftSize/2, the first window (frame 0) covers [-fftSize/2, fftSize/2] of original signal (so 0..fftSize/2)
        // We want the last window to cover up to signal.length.

        const padLen = this.fftSize / 2;

        // Calculate total length required to have an integer number of frames that cover the signal
        const minLength = signal.length + padLen * 2;
        const numFrames = Math.ceil((minLength - this.fftSize) / this.hopLength) + 1;
        const targetLength = (numFrames - 1) * this.hopLength + this.fftSize;

        const paddedSignal = new Float32Array(targetLength);

        // Reflection padding for left side
        paddedSignal.set(signal, padLen);
        for (let i = 0; i < padLen; i++) {
            paddedSignal[i] = signal[padLen - i];
        }

        // Fill the rest with reflection or zeros
        // We reflected left `padLen`. The signal is at `padLen`.
        // The signal ends at `padLen + signal.length`.
        // Right side padding starts there.
        const endOfSignal = padLen + signal.length;

        // Right reflection for available data, then zeros
        for (let i = 0; endOfSignal + i < targetLength; i++) {
            const idx = signal.length - 1 - i;
            // If we run out of signal to reflect, pad with zeros
            paddedSignal[endOfSignal + i] = idx >= 0 ? signal[idx] : 0;
        }

        const numFreqs = this.fftSize / 2 + 1;

        const magnitude = new Float32Array(numFreqs * numFrames);
        const phase = new Float32Array(numFreqs * numFrames);

        const real = new Float32Array(this.fftSize);
        const imag = new Float32Array(this.fftSize);

        for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
            const start = frameIdx * this.hopLength;

            for (let i = 0; i < this.fftSize; i++) {
                real[i] = paddedSignal[start + i] * this.window[i];
                imag[i] = 0;
            }

            // FFT (Simple naive implementation for now, should replace with web-fft or similar for speed)
            // Ideally we use a WASM FFT library here. For prototype, we'll implement a basic Cooley-Tukey if needed,
            // or a slow DFT for very small chunks. 
            // WAIT: Heavy FFT in JS is bad. 
            // Optimization: Use a small JS FFT lib logic.
            this.fft(real, imag);

            // Calculate Mag/Phase
            for (let k = 0; k < numFreqs; k++) {
                const r = real[k];
                const i = imag[k];
                const mag = Math.sqrt(r * r + i * i);
                const ph = Math.atan2(i, r);

                const outIdx = frameIdx * numFreqs + k;
                // Transpose to [1, freq, frames] logic usually expected, but flat buffer here
                // We'll store as [frames, freq] flat for now or [freq, frames]? 
                // PyTorch usually expects [Batch, Channels, Freq, Time].
                // Let's store [Freq, Time] (Column-major if Freq is rows)?
                // Standard row-major flat: Frame 0 (all freqs), Frame 1 (all freqs)
                // Let's stick to [Frame, Freq] for easier iteration unless model specific.
                // Actually Demucs expects [Batch, Channels, Freq, Time].
                // So we should construct it such that we can easily map.

                // Let's keep it simple: Flat buffer, Row-major: Frame 0 [Freq 0..N], Frame 1...
                magnitude[outIdx] = mag;
                phase[outIdx] = ph;
            }
        }

        return { magnitude, phase, dims: [numFrames, numFreqs] };
    }

    // Basic In-place FFT (Cooley-Tukey)
    // Size must be power of 2
    private fft(re: Float32Array, im: Float32Array) {
        const n = re.length;
        if (n <= 1) return;

        const bits = Math.log2(n);
        for (let i = 0; i < n; i++) {
            let k = 0;
            let j = i;
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

export class ISTFT {
    private fftSize: number;
    private hopLength: number;
    private window: Float32Array;

    constructor(fftSize: number = 4096, hopLength: number = 1024) {
        this.fftSize = fftSize;
        this.hopLength = hopLength;
        this.window = this.createHannWindow(fftSize);
    }

    private createHannWindow(size: number): Float32Array {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size));
        }
        return window;
    }

    /**
     * Reconstructs audio from magnitude and phase spectrograms.
     * Automatically removes padding applied during STFT.
     */
    process(magnitude: Float32Array, phase: Float32Array, dims: [number, number]): Float32Array {
        const [numFrames, numFreqs] = dims;
        const outputLen = (numFrames - 1) * this.hopLength + this.fftSize;
        const output = new Float32Array(outputLen);
        const normFactor = new Float32Array(outputLen);

        const real = new Float32Array(this.fftSize);
        const imag = new Float32Array(this.fftSize);

        for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
            // Reconstruct Real/Imag
            for (let k = 0; k < numFreqs; k++) {
                const idx = frameIdx * numFreqs + k;
                const mag = magnitude[idx];
                const ph = phase[idx];

                real[k] = mag * Math.cos(ph);
                imag[k] = mag * Math.sin(ph);

                // Conjugate symmetry for real-valued FFT
                if (k > 0 && k < numFreqs - 1) {
                    const conjIdx = this.fftSize - k;
                    if (conjIdx < this.fftSize) {
                        real[conjIdx] = real[k];
                        imag[conjIdx] = -imag[k];
                    }
                }
            }

            // Inverse FFT
            this.ifft(real, imag);

            // Overlap-Add
            const start = frameIdx * this.hopLength;
            for (let i = 0; i < this.fftSize; i++) {
                // Apply window again for proper reconstruction (Cola)
                // Assuming NOLA (Non-zero Overlap Add) compliance
                output[start + i] += real[i] * this.window[i];
                // Accumulate window squared for normalization
                normFactor[start + i] += this.window[i] * this.window[i];
            }
        }

        // Normalize
        for (let i = 0; i < outputLen; i++) {
            if (normFactor[i] > 1e-8) {
                output[i] /= normFactor[i];
            }
        }

        // Remove padding (center trimming)
        const padLen = this.fftSize / 2;
        // The valid region matches the original signal length roughly
        // If we padded by padLen on both sides, we trim padLen from start and end.
        const trimmedLen = outputLen - (padLen * 2);

        // Safety check
        if (trimmedLen <= 0) return new Float32Array(0);

        return output.slice(padLen, padLen + trimmedLen);
    }

    // Inverse FFT
    private ifft(re: Float32Array, im: Float32Array) {
        const n = re.length;

        // Conjugate input
        for (let i = 0; i < n; i++) {
            im[i] = -im[i];
        }

        // Forward FFT
        this.fft(re, im);

        // Conjugate output and scale
        for (let i = 0; i < n; i++) {
            im[i] = -im[i];
            re[i] /= n;
            im[i] /= n;
        }
    }

    // Duplicated FFT for now to keep classes independent if needed, 
    // or we can extract a shared FFT util. 
    // For simplicity of this file, inlined.
    private fft(re: Float32Array, im: Float32Array) {
        const n = re.length;
        if (n <= 1) return;

        const bits = Math.log2(n);
        for (let i = 0; i < n; i++) {
            let k = 0;
            let j = i;
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
