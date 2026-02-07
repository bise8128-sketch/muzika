/**
 * AudioWorklet Processor for Pitch and Tempo Control
 * Replaces deprecated ScriptProcessorNode with modern AudioWorklet API
 */

// Simple circular buffer for handling tempo changes
class CircularBuffer {
    constructor(size) {
        this.size = size;
        this.buffer = new Float32Array(size);
        this.writeIndex = 0;
        this.readIndex = 0;
    }

    write(data) {
        for (let i = 0; i < data.length; i++) {
            this.buffer[this.writeIndex] = data[i];
            this.writeIndex = (this.writeIndex + 1) % this.size;
        }
    }

    read(length) {
        const output = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            output[i] = this.buffer[this.readIndex];
            this.readIndex = (this.readIndex + 1) % this.size;
        }
        return output;
    }

    available() {
        if (this.writeIndex >= this.readIndex) {
            return this.writeIndex - this.readIndex;
        }
        return this.size - this.readIndex + this.writeIndex;
    }
}

/**
 * PitchTempoProcessor - AudioWorkletProcessor for real-time pitch/tempo manipulation
 */
class PitchTempoProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Initialize buffers (8192 samples should be enough for most use cases)
        this.leftBuffer = new CircularBuffer(8192);
        this.rightBuffer = new CircularBuffer(8192);
        this.pitch = 1.0;
        this.tempo = 1.0;
        this.phase = 0;

        // Listen for parameter updates from main thread
        this.port.onmessage = (event) => {
            const { type, value } = event.data;
            if (type === 'setPitch') {
                this.pitch = value;
            } else if (type === 'setTempo') {
                this.tempo = value;
            } else if (type === 'reset') {
                this.leftBuffer = new CircularBuffer(8192);
                this.rightBuffer = new CircularBuffer(8192);
                this.phase = 0;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        // If no input, return silence
        if (!input || input.length === 0) {
            return true;
        }

        const leftInput = input[0] || new Float32Array(128);
        const rightInput = input[1] || leftInput; // Mono -> Stereo

        const leftOutput = output[0];
        const rightOutput = output[1] || leftOutput;

        // Simple pitch shifting using resampling
        // This is a basic implementation - for production, you'd use a more sophisticated algorithm
        if (this.pitch === 1.0 && this.tempo === 1.0) {
            // No processing needed
            leftOutput.set(leftInput);
            if (rightOutput !== leftOutput) {
                rightOutput.set(rightInput);
            }
        } else {
            // Write input to buffer
            this.leftBuffer.write(leftInput);
            this.rightBuffer.write(rightInput);

            // Apply tempo/pitch by reading at adjusted rate
            for (let i = 0; i < 128; i++) {
                const srcIndexFloor = Math.floor(this.phase);
                const srcIndexCeil = (srcIndexFloor + 1);
                const frac = this.phase - srcIndexFloor;

                if (this.leftBuffer.available() > srcIndexCeil) {
                    const l1 = this.leftBuffer.buffer[(this.leftBuffer.readIndex + srcIndexFloor) % this.leftBuffer.size];
                    const l2 = this.leftBuffer.buffer[(this.leftBuffer.readIndex + srcIndexCeil) % this.leftBuffer.size];

                    const r1 = this.rightBuffer.buffer[(this.rightBuffer.readIndex + srcIndexFloor) % this.rightBuffer.size];
                    const r2 = this.rightBuffer.buffer[(this.rightBuffer.readIndex + srcIndexCeil) % this.rightBuffer.size];

                    leftOutput[i] = l1 * (1 - frac) + l2 * frac;
                    rightOutput[i] = r1 * (1 - frac) + r2 * frac;

                    // Advance phase based on effective rate
                    // pitch > 1 means higher frequency = play faster
                    // tempo > 1 means faster output = play faster
                    this.phase += (this.pitch / this.tempo);

                    while (this.phase >= 1) {
                        this.leftBuffer.read(1);
                        this.rightBuffer.read(1);
                        this.phase -= 1;
                    }
                } else {
                    leftOutput[i] = 0;
                    rightOutput[i] = 0;
                }
            }
        }

        return true; // Keep processor alive
    }
}

// Register the processor
registerProcessor('pitch-tempo-processor', PitchTempoProcessor);
