/**
 * AudioWorkletManager class for managing real-time audio processing
 * Wraps the GenericAudioProcessor and provides a clean interface
 */

import { GenericAudioProcessor } from './audioWorkletProcessor';

export class AudioWorkletManager {
    private audioContext: AudioContext;
    private processor: GenericAudioProcessor | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private initialized: boolean = false;
    private performanceCallbacks: ((metrics: any) => void)[] = [];
    private averageMetrics: any = null;

    constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;
    }

    /**
     * Initialize the AudioWorklet manager
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Create the AudioWorklet node
            this.workletNode = new AudioWorkletNode(this.audioContext, 'generic-audio-processor');

            // Connect the worklet node to the audio graph
            this.workletNode.connect(this.audioContext.destination);

            // Create the processor instance
            this.processor = new GenericAudioProcessor();

            // Set up message handling for performance metrics
            this.setupMessageHandling();

            this.initialized = true;

        } catch (error) {
            console.error('Failed to initialize AudioWorkletManager:', error);
            throw error;
        }
    }

    /**
     * Set up message handling for performance metrics
     */
    private setupMessageHandling(): void {
        if (!this.workletNode) return;

        this.workletNode.port.onmessage = (event: MessageEvent) => {
            const message = event.data;

            switch (message.type) {
                case 'metrics':
                    this.handleMetrics(message.data);
                    break;
                case 'error':
                    this.handleError(message.data);
                    break;
            }
        };
    }

    /**
     * Handle performance metrics from the processor
     */
    private handleMetrics(metrics: any): void {
        // Update average metrics
        if (!this.averageMetrics) {
            this.averageMetrics = { ...metrics, count: 1 };
        } else {
            this.averageMetrics.processingTime =
                (this.averageMetrics.processingTime * this.averageMetrics.count + metrics.processingTime) /
                (this.averageMetrics.count + 1);
            this.averageMetrics.memoryUsage =
                (this.averageMetrics.memoryUsage * this.averageMetrics.count + metrics.memoryUsage) /
                (this.averageMetrics.count + 1);
            this.averageMetrics.cpuUsage =
                (this.averageMetrics.cpuUsage * this.averageMetrics.count + metrics.cpuUsage) /
                (this.averageMetrics.count + 1);
            this.averageMetrics.count++;
        }

        // Call all registered callbacks
        this.performanceCallbacks.forEach(callback => {
            try {
                callback(metrics);
            } catch (error) {
                console.error('Error in performance callback:', error);
            }
        });
    }

    /**
     * Handle errors from the processor
     */
    private handleError(errorData: any): void {
        console.error('AudioWorklet error:', errorData);
    }

    /**
     * Set gain level for the processor
     */
    setGain(gain: number): void {
        if (this.processor) {
            this.processor.setGain(gain);
        }
    }

    /**
     * Set bypass mode for the processor
     */
    setBypass(bypass: boolean): void {
        if (this.processor) {
            this.processor.setBypass(bypass);
        }
    }

    /**
     * Register a callback for performance metrics updates
     */
    onMetricsUpdate(callback: (metrics: any) => void): void {
        this.performanceCallbacks.push(callback);
    }

    /**
     * Get average performance metrics
     */
    getAverageMetrics(): any | null {
        return this.averageMetrics;
    }

    /**
     * Get the AudioWorkletNode for connecting to the audio graph
     */
    getWorkletNode(): AudioWorkletNode | null {
        return this.workletNode;
    }

    /**
     * Destroy the manager and clean up resources
     */
    destroy(): void {
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode.port.close();
            this.workletNode = null;
        }

        this.processor = null;
        this.performanceCallbacks = [];
        this.averageMetrics = null;
        this.initialized = false;
    }

    /**
     * Check if the manager is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }
}