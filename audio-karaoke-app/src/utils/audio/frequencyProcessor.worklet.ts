/**
 * Frequency Analysis AudioWorklet Processor
 * Performs real-time FFT analysis on the audio stream
 * Runs in the AudioWorkletGlobalScope
 */

// Definitions for AudioWorkletGlobalScope
declare class AudioWorkletProcessor {
    readonly port: MessagePort;
    constructor();
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}

declare function registerProcessor(name: string, processorCtor: new () => AudioWorkletProcessor): void;

// Basic RingBuffer implementation for the worklet
class SimpleRingBuffer {
    buffer: Float32Array;
    writePos: number = 0;
    size: number;

    constructor(size: number) {
        this.size = size;
        this.buffer = new Float32Array(size);
    }

    push(data: Float32Array): void {
        const len = data.length;
        for (let i = 0; i < len; i++) {
            this.buffer[this.writePos] = data[i];
            this.writePos = (this.writePos + 1) % this.size;
        }
    }

    // Get the last N samples (linear)
    getLast(out: Float32Array): void {
        const len = out.length;
        if (len > this.size) return;

        let readPos = (this.writePos - len + this.size) % this.size;
        for (let i = 0; i < len; i++) {
            out[i] = this.buffer[readPos];
            readPos = (readPos + 1) % this.size;
        }
    }
}

class FrequencyProcessor extends AudioWorkletProcessor {
    private fftSize: number = 2048;
    private smoothingTimeConstant: number = 0.8;
    private buffer: SimpleRingBuffer;
    
    // Pre-allocated arrays for FFT
    private timeData: Float32Array;
    private real: Float32Array;
    private imag: Float32Array;
    private window: Float32Array;
    private frequencyData: Uint8Array;
    private lastFrequencyData: Float32Array; // For smoothing

    // Frame counter to limit message rate (e.g. 60fps)
    private framesSinceLastPost: number = 0;
    private postInterval: number = 6; // ~60fps with 128 samples/block approx

    constructor() {
        super();
        
        this.buffer = new SimpleRingBuffer(this.fftSize);
        this.timeData = new Float32Array(this.fftSize);
        this.real = new Float32Array(this.fftSize);
        this.imag = new Float32Array(this.fftSize);
        this.frequencyData = new Uint8Array(this.fftSize / 2);
        this.lastFrequencyData = new Float32Array(this.fftSize / 2);
        
        // Pre-compute Blackman window
        this.window = new Float32Array(this.fftSize);
        for (let i = 0; i < this.fftSize; i++) {
            // Blackman window
            const alpha = 0.16;
            const a0 = (1 - alpha) / 2;
            const a1 = 0.5;
            const a2 = alpha / 2;
            this.window[i] = a0 - a1 * Math.cos((2 * Math.PI * i) / (this.fftSize - 1)) + a2 * Math.cos((4 * Math.PI * i) / (this.fftSize - 1));
        }

        this.port.onmessage = (event: MessageEvent) => {
            if (event.data.type === 'config') {
                if (event.data.smoothingTimeConstant !== undefined) {
                    this.smoothingTimeConstant = event.data.smoothingTimeConstant;
                }
            }
        };
    }

    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        // Pass audio through
        const input = inputs[0];
        const output = outputs[0];
        
        if (!input || !input[0]) return true;

        // Copy input to output (pass-through)
        // We only process channel 0 for visualization to save CPU
        const channelData = input[0];
        
        // Pass through all channels
        for (let channel = 0; channel < output.length; channel++) {
             if (input[channel]) {
                 output[channel].set(input[channel]);
             }
        }

        // Buffer input for FFT
        this.buffer.push(channelData);

        this.framesSinceLastPost++;
        if (this.framesSinceLastPost >= this.postInterval) {
            this.performFFT();
            this.framesSinceLastPost = 0;
        }

        return true;
    }

    private performFFT() {
        // Get Time Domain Data
        this.buffer.getLast(this.timeData);

        // Apply Window & Prepare Complex Arrays
        for (let i = 0; i < this.fftSize; i++) {
            this.real[i] = this.timeData[i] * this.window[i];
            this.imag[i] = 0;
        }

        // Compute FFT
        this.fft(this.real, this.imag);

        // Compute Magnitude & Smooth
        // We only need the first half (Nyquist)
        const binCount = this.fftSize / 2;
        
        // Convert to dB and generic byte scale (simulating getByteFrequencyData)
        // AnalyserNode: minDecibels = -100, maxDecibels = -30
        const minDecibels = -100;
        const maxDecibels = -30;
        const range = maxDecibels - minDecibels;

        for (let i = 0; i < binCount; i++) {
            const magnitude = Math.sqrt(this.real[i] * this.real[i] + this.imag[i] * this.imag[i]);
            
            // Convert to dB
            // 20 * log10(magnitude)
            // Magnitude is linear amplitude. 20 log10(x)
            // Prevent log(0)
            const db = 20 * Math.log10(magnitude + 1e-6);

            // Smooth
            // current = smoothing * last + (1 - smoothing) * new
            const smoothedDb = this.smoothingTimeConstant * this.lastFrequencyData[i] + (1 - this.smoothingTimeConstant) * db;
            this.lastFrequencyData[i] = smoothedDb;

            // Map to 0-255
            // value = 255 * (db - minDecibels) / range
            let byteValue = 255 * (smoothedDb - minDecibels) / range;
            
            // Clamp
            if (byteValue < 0) byteValue = 0;
            if (byteValue > 255) byteValue = 255;

            this.frequencyData[i] = byteValue;
        }

        // Post data to main thread
        this.port.postMessage({
            type: 'frequency_data',
            data: this.frequencyData // We can send the view, it will be copied or structured cloned
        });
    }

    // In-place FFT
    // Cooley-Tukey algorithm
    private fft(real: Float32Array, imag: Float32Array) {
        const n = real.length;
        
        // Bit Reversal Permutation
        let j = 0;
        for (let i = 0; i < n - 1; i++) {
            if (i < j) {
                let temp = real[i]; real[i] = real[j]; real[j] = temp;
                temp = imag[i]; imag[i] = imag[j]; imag[j] = temp;
            }
            let k = n >> 1;
            while (k <= j) {
                j -= k;
                k >>= 1;
            }
            j += k;
        }

        // Butterfly Operations
        let step = 1;
        while (step < n) {
            const jump = step << 1;
            const deltaAngle = -Math.PI / step;
            
            // Standard implementation of sine/cosine recurrence
            // alpha = 2 * sin(theta/2)^2
            // beta = sin(theta)
            const alpha = 2.0 * Math.pow(Math.sin(deltaAngle * 0.5), 2);
            const beta = Math.sin(deltaAngle);
            
            let wr = 1.0;
            let wi = 0.0;

            for (let i = 0; i < step; i++) {
                // Optimization: Compute these once per step
                for (let j = i; j < n; j += jump) {
                    const k = j + step;
                    
                    const tr = wr * real[k] - wi * imag[k];
                    const ti = wr * imag[k] + wi * real[k];
                    
                    real[k] = real[j] - tr;
                    imag[k] = imag[j] - ti;
                    real[j] += tr;
                    imag[j] += ti;
                }
                
                // Recurrence
                const tempp = wr;
                wr = wr - (alpha * wr + beta * wi);
                wi = wi - (alpha * wi - beta * tempp);
            }
            step = jump;
        }
    }
}

registerProcessor('frequency-processor', FrequencyProcessor);
