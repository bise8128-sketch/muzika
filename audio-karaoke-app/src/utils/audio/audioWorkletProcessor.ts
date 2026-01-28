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
    type: 'config' | 'metrics' | 'error' | 'ping' | 'pong';
    data?: any;
    timestamp?: number;
}

// Global registerProcessor function - this will be available in the AudioWorklet context
declare function registerProcessor(name: string, processor: any): void;

/**
 * Generic audio processor for basic audio manipulation
 * This is the actual AudioWorklet processor that runs in the audio thread
 */
class GenericAudioProcessor {
    private config: AudioWorkletProcessorConfig;
    private metrics: PerformanceMetrics;
    private lastProcessTime: number = 0;
    private processCount: number = 0;
    private startTime: number = performance.now();
    private gain: number = 1.0;
    private bypass: boolean = false;
    private pingInterval: number | null = null;

    constructor() {
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

        this.initializeMessageHandling();
        this.startPerformanceMonitoring();
    }

    /**
     * Initialize message handling for configuration and control
     */
    private initializeMessageHandling(): void {
        self.onmessage = (event: MessageEvent<AudioWorkletMessage>) => {
            try {
                this.handleMessage(event.data);
            } catch (error) {
                if (this.config.enableErrorHandling) {
                    this.handleError(error, 'message handling');
                }
            }
        };
    }

    /**
     * Handle incoming messages from the main thread
     */
    private handleMessage(message: AudioWorkletMessage): void {
        switch (message.type) {
            case 'config':
                this.updateConfig(message.data);
                break;
            case 'ping':
                this.handlePing();
                break;
            case 'metrics':
                this.reportMetrics();
                break;
            default:
                if (this.config.enableErrorHandling) {
                    console.warn(`Unknown message type: ${message.type}`);
                }
        }
    }

    /**
     * Update processor configuration
     */
    private updateConfig(newConfig: Partial<AudioWorkletProcessorConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Handle ping for latency measurement
     */
    private handlePing(): void {
        const pongMessage: AudioWorkletMessage = {
            type: 'pong',
            timestamp: performance.now()
        };
        self.postMessage(pongMessage);
    }

    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring(): void {
        if (!this.config.enablePerformanceMonitoring) return;

        this.pingInterval = setInterval(() => {
            this.updateMetrics();
            this.reportMetrics();
        }, 1000) as unknown as number;
    }

    /**
     * Update performance metrics
     */
    private updateMetrics(): void {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastProcessTime;

        this.metrics.processingTime = deltaTime;
        this.metrics.timestamp = currentTime;

        // Estimate memory usage (approximation)
        if ((performance as any).memory) {
            this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
        }

        // Calculate CPU usage (approximation based on processing time)
        this.metrics.cpuUsage = Math.min(100, (deltaTime / 16.67) * 100); // Assuming 60fps baseline

        this.lastProcessTime = currentTime;
    }

    /**
     * Report metrics to main thread
     */
    private reportMetrics(): void {
        if (!this.config.enablePerformanceMonitoring) return;

        const message: AudioWorkletMessage = {
            type: 'metrics',
            data: this.metrics
        };

        self.postMessage(message);
    }

    /**
     * Handle errors gracefully
     */
    private handleError(error: any, context: string): void {
        const errorMessage: AudioWorkletMessage = {
            type: 'error',
            data: {
                error: error.message || error,
                context,
                timestamp: performance.now(),
                processor: 'GenericAudioProcessor'
            }
        };

        self.postMessage(errorMessage);
        console.error(`AudioWorklet error in ${context}:`, error);
    }

    /**
     * Process audio data
     */
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        try {
            const startTime = performance.now();

            if (this.bypass || inputs.length === 0 || outputs.length === 0) {
                // Bypass mode: copy input to output
                for (let channel = 0; channel < inputs.length && channel < outputs.length; channel++) {
                    if (inputs[channel] && outputs[channel] && inputs[channel].length === outputs[channel].length) {
                        for (let sample = 0; sample < inputs[channel].length; sample++) {
                            outputs[channel][sample] = inputs[channel][sample];
                        }
                    }
                }
            } else {
                // Process each channel
                for (let channel = 0; channel < inputs.length && channel < outputs.length; channel++) {
                    const input = inputs[channel];
                    const output = outputs[channel];

                    if (input && output && input.length === output.length) {
                        // Apply gain
                        for (let sample = 0; sample < input.length; sample++) {
                            (output as any)[sample] = (input as any)[sample] * this.gain;
                        }
                    }
                }
            }

            // Update metrics
            this.processCount++;
            this.lastProcessTime = performance.now();

            if (this.config.enablePerformanceMonitoring) {
                this.metrics.processingTime = this.lastProcessTime - startTime;
                this.metrics.latency = this.lastProcessTime - this.startTime;
            }

            return true;

        } catch (error) {
            if (this.config.enableErrorHandling) {
                this.handleError(error, 'audio processing');
            }
            return false; // Indicate processing failure
        }
    }

    /**
     * Set gain level
     */
    setGain(gain: number): void {
        this.gain = Math.max(0, Math.min(2, gain));
    }

    /**
     * Set bypass mode
     */
    setBypass(bypass: boolean): void {
        this.bypass = bypass;
    }
}

// Register the processor
registerProcessor('generic-audio-processor', GenericAudioProcessor);