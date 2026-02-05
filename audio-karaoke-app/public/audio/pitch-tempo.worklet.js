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

            // Apply tempo by reading at different rate
            const readRate = this.tempo / this.pitch;
            const samplesToRead = Math.floor(128 * readRate);

            // Only process if we have enough samples
            if (this.leftBuffer.available() >= samplesToRead) {
                const leftRead = this.leftBuffer.read(samplesToRead);
                const rightRead = this.rightBuffer.read(samplesToRead);

                // Resample to 128 samples (simple linear interpolation)
                for (let i = 0; i < 128; i++) {
                    const srcIndex = (i / 128) * samplesToRead;
                    const srcIndexFloor = Math.floor(srcIndex);
                    const srcIndexCeil = Math.min(srcIndexFloor + 1, samplesToRead - 1);
                    const frac = srcIndex - srcIndexFloor;

                    // Apply pitch shift via resampling
                    const pitchedIndex = srcIndex * this.pitch;
                    const pitchedFloor = Math.floor(pitchedIndex) % samplesToRead;
                    const pitchedCeil = Math.ceil(pitchedIndex) % samplesToRead;
                    const pitchFrac = pitchedIndex - Math.floor(pitchedIndex);

                    // Linear interpolation with pitch shift
                    leftOutput[i] = leftRead[pitchedFloor] * (1 - pitchFrac) +
                        leftRead[pitchedCeil] * pitchFrac;
                    rightOutput[i] = rightRead[pitchedFloor] * (1 - pitchFrac) +
                        rightRead[pitchedCeil] * pitchFrac;
                }
            } else {
                // Not enough data yet, output silence
                leftOutput.fill(0);
                if (rightOutput !== leftOutput) {
                    rightOutput.fill(0);
                }
            }
        }

        return true; // Keep processor alive
    }
}

// Register the processor
registerProcessor('pitch-tempo-processor', PitchTempoProcessor);
