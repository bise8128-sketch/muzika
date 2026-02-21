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
import { PitchCorrector } from './pitchCorrection';

// Define a base class that works in both Worklet and Main thread contexts for compilation
let BaseProcessor: { new(): AudioWorkletProcessor } = class {
    port = { postMessage: (_msg: AudioWorkletMessage, _transfers?: Transferable[]) => {}, onmessage: null as any };
} as any;

if (typeof globalThis !== 'undefined' && 'AudioWorkletProcessor' in globalThis) {
    BaseProcessor = (globalThis as any).AudioWorkletProcessor;
}

/**
 * Generic audio processor for basic audio manipulation
 * This is the actual AudioWorklet processor that runs in the audio thread
 */
export class GenericAudioProcessor extends BaseProcessor {
    private lastPitchReportTime: number = 0;
    private pitchReportInterval: number = 50; // ms
    private pitchBuffer: Float32Array;
    private internalPitchBuffer: Float32Array;
    private pitchResult: { frequency: number, midiNote: number, confidence: number, timestamp: number } | null = null;
    
    private config: AudioWorkletProcessorConfig;
    private metrics: PerformanceMetrics;
    private gain: number = 1.0;
    private bypass: boolean = false;
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

        // Pre-allocate buffers for pitch detection
        // 2048 samples is a good balance for latency and accuracy down to ~80Hz at 44.1kHz
        this.pitchBuffer = new Float32Array(2048);
        const maxPeriod = Math.floor(44100 / 80);
        this.internalPitchBuffer = new Float32Array(maxPeriod + 1);

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
        this.metrics.memoryUsage = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize || 0;
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
            const inputChannels = inputs[0];
            const outputChannels = outputs[0];

            // 1. Pitch Detection (Microphone Input)
            if (inputChannels && inputChannels[0]) {
                const micInput = inputChannels[0];
                
                // Shift old samples and add new ones (circular buffer style in a linear array)
                // In a real high-perf app, we might use a RingBuffer for input too, 
                // but for 2048 samples, a set/copy is often acceptable if done carefully.
                // However, the rule is ZERO allocation.
                this.pitchBuffer.set(this.pitchBuffer.subarray(micInput.length));
                this.pitchBuffer.set(micInput, this.pitchBuffer.length - micInput.length);

                // Analyze pitch if it's time
                if (startTime - this.lastPitchReportTime > this.pitchReportInterval) {
                    this.pitchResult = PitchCorrector.detectPitch(
                        this.pitchBuffer, 
                        this.config.sampleRate || 44100,
                        this.internalPitchBuffer
                    );

                    if (this.pitchResult && this.pitchResult.confidence > 0.4) {
                        this.port.postMessage({
                            type: 'metrics', // Reuse metrics or create new type
                            data: {
                                type: 'pitch',
                                pitch: this.pitchResult.frequency,
                                confidence: this.pitchResult.confidence,
                                timestamp: startTime
                            }
                        });
                    }
                    this.lastPitchReportTime = startTime;
                }
            }

            // 2. Playback / Synthesis
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
            } else if (this.bypass && inputChannels) {
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
                this.metrics.cpuUsage = (this.metrics.processingTime / (128 / (this.config.sampleRate! / 1000))) * 100;
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