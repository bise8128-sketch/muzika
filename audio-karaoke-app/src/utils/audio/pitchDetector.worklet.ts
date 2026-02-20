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
    private postInterval: number = 3; // roughly 30-40 fps for pitch detection (128 samples per frame * 3 = 384 samples) ~ 114fps. Actually let's use 6 for ~60fps.

    constructor(options?: AudioWorkletNodeOptions) {
        super();
        this.sampleRateVal = options?.processorOptions?.sampleRate || 44100;
        this.ringBuffer = new PitchDetectorRingBuffer(this.bufferSize);
        this.analysisBuffer = new Float32Array(this.bufferSize);
        this.postInterval = 3; // Update pitch quickly for UI
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

        const autocorr = new Float32Array(maxPeriod + 1);
        let energy = 0;
        for (let i = 0; i < bufferSize; i++) {
            energy += buffer[i] * buffer[i];
        }
        autocorr[0] = energy;

        for (let lag = minPeriod; lag <= maxPeriod; lag++) {
            let sum = 0;
            for (let i = 0; i < bufferSize - lag; i++) {
                sum += buffer[i] * buffer[i + lag];
            }
            autocorr[lag] = sum;
        }

        let peakLag = minPeriod;
        let peakValue = autocorr[minPeriod];

        for (let lag = minPeriod + 1; lag <= maxPeriod; lag++) {
            if (autocorr[lag] > peakValue) {
                peakValue = autocorr[lag];
                peakLag = lag;
            }
        }

        const confidence = peakValue / (autocorr[0] + 1e-10);

        if (confidence < 0.3) {
            this.port.postMessage({ type: 'pitch_data', frequency: 0, confidence: 0 });
            return;
        }

        // Parabolic interpolation for better precision
        let refinedLag = peakLag;
        if (peakLag > minPeriod && peakLag < maxPeriod) {
            const y1 = autocorr[peakLag - 1];
            const y2 = autocorr[peakLag];
            const y3 = autocorr[peakLag + 1];
            // peak offset = (y1 - y3) / (2 * (y1 - 2*y2 + y3))
            const denominator = 2 * (y1 - 2 * y2 + y3);
            if (denominator !== 0) {
                refinedLag += (y1 - y3) / denominator;
            }
        }

        const frequency = sampleRate / refinedLag;

        this.port.postMessage({ 
            type: 'pitch_data', 
            frequency, 
            confidence
        });
    }
}

registerProcessor('pitch-detector', PitchDetectorProcessor);
