/**
 * Audio effects manager for real-time audio processing
 * Manages AudioWorklet nodes and effects chain
 */

import { getAudioContext, getWorkletNode, setWorkletGain, setWorkletBypass, onWorkletMetricsUpdate, getWorkletAverageMetrics } from './audioContext';

export interface EffectsConfig {
    gain: number;
    bypass: boolean;
    enablePerformanceMonitoring: boolean;
}

export interface EffectsState {
    isInitialized: boolean;
    isSupported: boolean;
    currentConfig: EffectsConfig;
    performanceMetrics: any[];
    averageMetrics: any | null;
}

export class EffectsManager {
    private audioContext: AudioContext;
    private workletNode: AudioWorkletNode | null = null;
    private state: EffectsState;
    private metricsCallback: ((metrics: any) => void) | null = null;

    constructor() {
        this.audioContext = getAudioContext();
        this.state = {
            isInitialized: false,
            isSupported: false,
            currentConfig: {
                gain: 1.0,
                bypass: false,
                enablePerformanceMonitoring: true
            },
            performanceMetrics: [],
            averageMetrics: null
        };

        this.initialize();
    }

    /**
     * Initialize the effects manager
     */
    private async initialize(): Promise<void> {
        try {
            // Check if AudioWorklet is supported
            if (!this.audioContext.audioWorklet) {
                console.warn('AudioWorklet is not supported in this browser');
                this.state.isSupported = false;
                return;
            }

            this.state.isSupported = true;

            // Get the worklet node (this will initialize the AudioWorkletManager if needed)
            this.workletNode = await getWorkletNode();

            if (this.workletNode) {
                // Set up initial configuration
                this.applyConfig();

                // Set up metrics monitoring
                onWorkletMetricsUpdate(this.handleMetricsUpdate.bind(this));

                this.state.isInitialized = true;
            }

        } catch (error) {
            console.error('Failed to initialize effects manager:', error);
            this.state.isSupported = false;
        }
    }

    /**
     * Apply current configuration to the worklet
     */
    private applyConfig(): void {
        if (!this.workletNode) return;

        // Apply gain
        setWorkletGain(this.state.currentConfig.gain);

        // Apply bypass
        setWorkletBypass(this.state.currentConfig.bypass);

        // Apply performance monitoring
        // This is handled by the worklet itself
    }

    /**
     * Handle metrics updates from the worklet
     */
    private handleMetricsUpdate(metrics: any): void {
        this.state.performanceMetrics.push(metrics);

        // Keep only the last 60 metrics (1 minute of data)
        if (this.state.performanceMetrics.length > 60) {
            this.state.performanceMetrics.shift();
        }

        // Update average metrics
        this.state.averageMetrics = getWorkletAverageMetrics();

        // Call user callback if set
        if (this.metricsCallback) {
            this.metricsCallback(metrics);
        }
    }

    /**
     * Set gain for the effects chain
     * @param gain - Gain level (0.0 to 2.0)
     */
    setGain(gain: number): void {
        if (gain < 0 || gain > 2) {
            throw new Error('Gain must be between 0.0 and 2.0');
        }

        this.state.currentConfig.gain = gain;
        setWorkletGain(gain);
    }

    /**
     * Set bypass mode
     * @param bypass - Whether to bypass audio processing
     */
    setBypass(bypass: boolean): void {
        this.state.currentConfig.bypass = bypass;
        setWorkletBypass(bypass);
    }

    /**
     * Enable or disable performance monitoring
     * @param enabled - Whether to enable performance monitoring
     */
    setPerformanceMonitoring(enabled: boolean): void {
        this.state.currentConfig.enablePerformanceMonitoring = enabled;
        // This is handled by the worklet itself
    }

    /**
     * Get current state
     */
    getState(): EffectsState {
        return { ...this.state };
    }

    /**
     * Get current configuration
     */
    getConfig(): EffectsConfig {
        return { ...this.state.currentConfig };
    }

    /**
     * Get performance metrics
     */
    getMetrics(): any[] {
        return [...this.state.performanceMetrics];
    }

    /**
     * Get average performance metrics
     */
    getAverageMetrics(): any | null {
        return this.state.averageMetrics;
    }

    /**
     * Set callback for performance metrics updates
     * @param callback - Function to call with metrics data
     */
    onMetricsUpdate(callback: (metrics: any) => void): void {
        this.metricsCallback = callback;
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        if (this.workletNode) {
            this.workletNode.port.close();
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        this.state = {
            isInitialized: false,
            isSupported: false,
            currentConfig: {
                gain: 1.0,
                bypass: false,
                enablePerformanceMonitoring: true
            },
            performanceMetrics: [],
            averageMetrics: null
        };
        this.metricsCallback = null;
    }
}

// Export a singleton instance
export const effectsManager = new EffectsManager();