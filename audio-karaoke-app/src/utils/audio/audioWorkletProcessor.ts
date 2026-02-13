/**
 * AudioWorklet processor for real-time audio effects
 * Base processor class with performance monitoring and error handling
 */

export interface AudioWorkletProcessorConfig {
    bufferSize?: number;
    sampleRate?: number;
    enablePerformanceMonitoring?: boolean;
    enableErrorHandling?: boolean;
}

export interface PerformanceMetrics {
    processingTime: number;
    memoryUsage: number;
    bufferUnderruns: number;
    latency: number;
    cpuUsage: number;
    timestamp: number;
}

export interface AudioWorkletMessage {
    type: 'config' | 'metrics' | 'error' | 'ping' | 'pong' | 'push_samples' | 'play' | 'pause' | 'clear';
    data?: unknown;
    timestamp?: number;
}

// Global registerProcessor function - this will be available in the AudioWorklet context

import { RingBuffer } from './RingBuffer';

// Define a base class that works in both Worklet and Main thread contexts for compilation
let BaseProcessor: any = class {
    port = { postMessage: (_msg: any, _transfers?: any) => {}, onmessage: null as any };
};

if (typeof AudioWorkletProcessor !== 'undefined') {
    BaseProcessor = AudioWorkletProcessor;
}

/**
 * Generic audio processor for basic audio manipulation
 * This is the actual AudioWorklet processor that runs in the audio thread
 */
export class GenericAudioProcessor extends BaseProcessor {
    private config: AudioWorkletProcessorConfig;
    private metrics: PerformanceMetrics;
    private lastProcessTime: number = 0;
    private processCount: number = 0;
    private startTime: number = performance.now();
    private gain: number = 1.0;
    private bypass: boolean = false;
    
    // Pipelining
    private ringBuffer: RingBuffer;
    private isPlaying: boolean = false;

    constructor() {
        super();
        this.config = {
            bufferSize: 128,
            sampleRate: 44100,
            enablePerformanceMonitoring: true,
            enableErrorHandling: true
        };

        this.metrics = {
            processingTime: 0,
            memoryUsage: 0,
            bufferUnderruns: 0,
            latency: 0,
            cpuUsage: 0,
            timestamp: performance.now()
        };

        // Initialize ring buffer with 1 second of capacity by default
        this.ringBuffer = new RingBuffer(44100 * 1, 2);

        this.port.onmessage = (event: MessageEvent<AudioWorkletMessage>) => {
            try {
                this.handleMessage(event.data);
            } catch (error) {
                if (this.config.enableErrorHandling) {
                    this.handleError(error, 'message handling');
                }
            }
        };

        if (this.config.enablePerformanceMonitoring) {
            setInterval(() => {
                this.reportMetrics();
            }, 1000);
        }
    }

    /**
     * Handle incoming messages from the main thread
     */
    private handleMessage(message: AudioWorkletMessage): void {
        switch (message.type) {
            case 'push_samples':
                const { channels } = message.data as { channels: Float32Array[] };
                this.ringBuffer.push(channels);
                break;
            case 'play':
                this.isPlaying = true;
                break;
            case 'pause':
                this.isPlaying = false;
                break;
            case 'clear':
                this.ringBuffer.clear();
                break;
            case 'config':
                const newConfig = message.data as Partial<AudioWorkletProcessorConfig>;
                this.config = { ...this.config, ...newConfig };
                break;
            case 'ping':
                this.port.postMessage({ type: 'pong', timestamp: performance.now() });
                break;
        }
    }

    /**
     * Report metrics to main thread
     */
    private reportMetrics(): void {
        if (!this.config.enablePerformanceMonitoring) return;

        const currentTime = performance.now();
        this.metrics.memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
        this.metrics.timestamp = currentTime;

        this.port.postMessage({
            type: 'metrics',
            data: this.metrics
        });
    }

    private handleError(error: unknown, context: string): void {
        const message = error instanceof Error ? error.message : String(error);
        this.port.postMessage({
            type: 'error',
            data: { error: message, context, timestamp: performance.now() }
        });
    }

    /**
     * Process audio data
     */
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        try {
            const startTime = performance.now();
            const outputChannels = outputs[0];

            if (!outputChannels || !outputChannels[0]) return true;

            if (this.isPlaying && !this.bypass) {
                const read = this.ringBuffer.pull(outputChannels);
                
                if (read < outputChannels[0].length) {
                    this.metrics.bufferUnderruns++;
                }

                // Apply gain
                if (this.gain !== 1.0) {
                    for (let c = 0; c < outputChannels.length; c++) {
                        const out = outputChannels[c];
                        for (let i = 0; i < out.length; i++) {
                            out[i] *= this.gain;
                        }
                    }
                }
            } else if (this.bypass && inputs[0]) {
                const inputChannels = inputs[0];
                for (let c = 0; c < inputChannels.length && c < outputChannels.length; c++) {
                    outputChannels[c].set(inputChannels[c]);
                }
            } else {
                // Silence
                for (let c = 0; c < outputChannels.length; c++) {
                    outputChannels[c].fill(0);
                }
            }

            // Update metrics
            if (this.config.enablePerformanceMonitoring) {
                const endTime = performance.now();
                this.metrics.processingTime = endTime - startTime;
                this.metrics.cpuUsage = (this.metrics.processingTime / (128 / 44.1)) * 100; // ~2.9ms for 128 samples at 44.1kHz
            }

            return true;

        } catch (error) {
            if (this.config.enableErrorHandling) {
                this.handleError(error, 'audio processing');
            }
            return false;
        }
    }

    setGain(gain: number): void {
        this.gain = Math.max(0, Math.min(2, gain));
    }

    setBypass(bypass: boolean): void {
        this.bypass = bypass;
    }
}

// Register the processor