/**
 * Simple RingBuffer for audio samples
 * Ensures thread-safe-ish (within same context) read/write operations
 */
export class RingBuffer {
    private buffer: Float32Array[];
    private writePos: number = 0;
    private readPos: number = 0;
    private length: number = 0;
    private capacity: number;
    private numChannels: number;

    constructor(capacity: number, numChannels: number = 2) {
        this.capacity = capacity;
        this.numChannels = numChannels;
        this.buffer = Array.from({ length: numChannels }, () => new Float32Array(capacity));
    }

    /**
     * Write samples to the buffer
     */
    push(channels: Float32Array[]): number {
        const samplesToWrite = channels[0].length;
        const available = this.capacity - this.length;
        const actualWrite = Math.min(samplesToWrite, available);

        for (let c = 0; c < this.numChannels; c++) {
            const data = channels[c];
            if (!data) continue;
            
            for (let i = 0; i < actualWrite; i++) {
                this.buffer[c][(this.writePos + i) % this.capacity] = data[i];
            }
        }

        this.writePos = (this.writePos + actualWrite) % this.capacity;
        this.length += actualWrite;

        return actualWrite;
    }

    /**
     * Read samples from the buffer
     */
    pull(outputs: Float32Array[]): number {
        const samplesToRead = outputs[0].length;
        const actualRead = Math.min(samplesToRead, this.length);

        for (let c = 0; c < this.numChannels; c++) {
            const out = outputs[c];
            if (!out) continue;

            for (let i = 0; i < actualRead; i++) {
                out[i] = this.buffer[c][(this.readPos + i) % this.capacity];
            }
            
            // Fill remainder with silence if buffer is empty
            for (let i = actualRead; i < samplesToRead; i++) {
                out[i] = 0;
            }
        }

        this.readPos = (this.readPos + actualRead) % this.capacity;
        this.length -= actualRead;

        return actualRead;
    }

    getAvailableRead(): number {
        return this.length;
    }

    getAvailableWrite(): number {
        return this.capacity - this.length;
    }

    clear(): void {
        this.readPos = 0;
        this.writePos = 0;
        this.length = 0;
        for (let c = 0; c < this.numChannels; c++) {
            this.buffer[c].fill(0);
        }
    }
}
