/**
 * Pitch Detection AudioWorklet Processor
 * Runs autocorrelation directly in the AudioWorklet thread
 */

class PitchDetectorRingBuffer {
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

class PitchDetectorProcessor extends AudioWorkletProcessor {
    private bufferSize = 2048;
    private ringBuffer: PitchDetectorRingBuffer;
    private analysisBuffer: Float32Array;

    private sampleRateVal: number = 44100;

    private framesSinceLastPost: number = 0;
    private postInterval: number = 6; // roughly 60 fps for pitch detection (128 samples per frame * 6 = 768 samples) ~ 57fps.

    private yinBuffer: Float32Array;

    constructor(options?: AudioWorkletNodeOptions) {
        super();
        this.sampleRateVal = options?.processorOptions?.sampleRate || 44100;
        this.ringBuffer = new PitchDetectorRingBuffer(this.bufferSize);
        this.analysisBuffer = new Float32Array(this.bufferSize);
        this.postInterval = 6; // Target ~60FPS for UI smoothness
        
        const maxPeriod = Math.floor(this.sampleRateVal / 80);
        this.yinBuffer = new Float32Array(maxPeriod + 1);
    }

    process(inputs: Float32Array[][], _outputs: Float32Array[][]): boolean {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const channelData = input[0];
        this.ringBuffer.push(channelData);

        this.framesSinceLastPost++;
        if (this.framesSinceLastPost >= this.postInterval) {
            this.framesSinceLastPost = 0;
            this.detectPitch();
        }

        return true;
    }

    private detectPitch() {
        this.ringBuffer.getLast(this.analysisBuffer);

        const sampleRate = this.sampleRateVal;
        const buffer = this.analysisBuffer;
        const bufferSize = buffer.length;

        const minPeriod = Math.floor(sampleRate / 1200); // Max ~1200 Hz
        const maxPeriod = Math.floor(sampleRate / 80);   // Min ~80 Hz
        const yinBuffer = this.yinBuffer;

        let energy = 0;
        for (let i = 0; i < bufferSize; i++) {
            energy += buffer[i] * buffer[i];
        }
        if (energy < 1e-10) {
            this.port.postMessage({ type: 'pitch_data', frequency: 0, confidence: 0 });
            return;
        }

        // 1. Difference function
        for (let lag = 1; lag <= maxPeriod; lag++) {
            let sum = 0;
            for (let i = 0; i < bufferSize - lag; i++) {
                const delta = buffer[i] - buffer[i + lag];
                sum += delta * delta;
            }
            yinBuffer[lag] = sum;
        }

        // 2. Cumulative mean normalized difference
        yinBuffer[0] = 1;
        let runningSum = 0;
        for (let lag = 1; lag <= maxPeriod; lag++) {
            runningSum += yinBuffer[lag];
            yinBuffer[lag] = yinBuffer[lag] * lag / (runningSum || 1);
        }

        // 3. Absolute thresholding
        const threshold = 0.15;
        let peakLag = -1;
        for (let lag = minPeriod; lag <= maxPeriod; lag++) {
            if (yinBuffer[lag] < threshold) {
                // Find local minimum
                let r = lag;
                while (r + 1 <= maxPeriod && yinBuffer[r + 1] < yinBuffer[r]) {
                    r++;
                }
                peakLag = r;
                break;
            }
        }

        if (peakLag === -1) {
            this.port.postMessage({ type: 'pitch_data', frequency: 0, confidence: 0 });
            return;
        }

        // 4. Parabolic interpolation
        let refinedLag = peakLag;
        if (peakLag > 1 && peakLag < maxPeriod) {
            const s0 = yinBuffer[peakLag - 1];
            const s1 = yinBuffer[peakLag];
            const s2 = yinBuffer[peakLag + 1];
            const denominator = 2 * (s0 - 2 * s1 + s2);
            if (denominator !== 0) {
                refinedLag += (s0 - s2) / denominator;
            }
        }

        const frequency = sampleRate / refinedLag;
        const confidence = Math.max(0, 1.0 - yinBuffer[peakLag]);

        this.port.postMessage({ 
            type: 'pitch_data', 
            frequency, 
            confidence
        });
    }
}

registerProcessor('pitch-detector', PitchDetectorProcessor);
