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
    private buffer: SimpleRingBuffer;
    private timeData: Float32Array;
    
    // Frame counter to limit message rate (e.g. 60fps)
    private framesSinceLastPost: number = 0;
    private postInterval: number = 6; // ~60fps with 128 samples/block approx

    private visualizerPort: MessagePort | null = null;

    constructor() {
        super();
        
        this.buffer = new SimpleRingBuffer(this.fftSize);
        this.timeData = new Float32Array(this.fftSize);

        this.port.onmessage = (event: MessageEvent) => {
            if (event.data.type === 'connect_visualizer') {
                this.visualizerPort = event.data.port;
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

        // Buffer input for rendering
        this.buffer.push(channelData);

        this.framesSinceLastPost++;
        if (this.framesSinceLastPost >= this.postInterval) {
            this.postTimeDomainData();
            this.framesSinceLastPost = 0;
        }

        return true;
    }

    private postTimeDomainData() {
        this.buffer.getLast(this.timeData);
        
        // Send data directly to main thread if required
        this.port.postMessage({
            type: 'time_domain_data',
            data: this.timeData
        });

        // Post to visualizer worker where FFT will happen
        if (this.visualizerPort) {
            this.visualizerPort.postMessage({
                type: 'time_domain_data',
                data: this.timeData
            });
        }
    }
}

registerProcessor('frequency-processor', FrequencyProcessor);
