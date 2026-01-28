/**
 * AudioContext initialization and management
 * Handles Web Audio API context creation and state management with AudioWorklet support
 */

import { effectsManager } from './effectsManager';

let audioContext: AudioContext | null = null;
let gainNode: GainNode | null = null;
let workletManager: AudioWorkletManager | null = null;

/**
 * Initialize and get the global AudioContext
 * Sample rate: 44100 Hz (standard for audio processing)
 */
export function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 44100,
            latencyHint: 'interactive',
        });

        // Create gain node for volume control
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);

        // Initialize AudioWorklet manager
        workletManager = new AudioWorkletManager(audioContext);
    }

    // Resume context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    return audioContext;
}

/**
 * Get the global GainNode for volume control
 */
export function getGainNode(): GainNode {
    if (!gainNode) {
        getAudioContext(); // This will create the gain node
    }
    return gainNode!;
}

/**
 * Get the AudioWorklet manager for real-time audio processing
 */
export function getWorkletManager(): AudioWorkletManager | null {
    if (!workletManager) {
        const ctx = getAudioContext();
        if (ctx) {
            workletManager = new AudioWorkletManager(ctx);
        }
    }
    return workletManager;
}

/**
 * Initialize AudioWorklet for real-time audio processing
 */
export async function initializeAudioWorklet(): Promise<void> {
    const manager = getWorkletManager();
    if (manager) {
        await manager.initialize();
    }
}

/**
 * Set master volume
 * @param volume - Volume level (0.0 to 1.0)
 */
export function setVolume(volume: number): void {
    const gain = getGainNode();
    gain.gain.value = Math.max(0, Math.min(1, volume));
}

/**
 * Set AudioWorklet gain for real-time processing
 * @param gain - Gain level (0.0 to 2.0)
 */
export function setWorkletGain(gain: number): void {
    const manager = getWorkletManager();
    if (manager) {
        manager.setGain(gain);
    }
}

/**
 * Set AudioWorklet bypass mode
 * @param bypass - Whether to bypass audio processing
 */
export function setWorkletBypass(bypass: boolean): void {
    const manager = getWorkletManager();
    if (manager) {
        manager.setBypass(bypass);
    }
}

/**
 * Set callback for performance metrics from AudioWorklet
 * @param callback - Function to call with metrics data
 */
export function onWorkletMetricsUpdate(callback: (metrics: any) => void): void {
    const manager = getWorkletManager();
    if (manager) {
        manager.onMetricsUpdate(callback);
    }
}

/**
 * Get average performance metrics from AudioWorklet
 */
export function getWorkletAverageMetrics(): any | null {
    const manager = getWorkletManager();
    if (manager) {
        return manager.getAverageMetrics();
    }
    return null;
}

/**
 * Suspend AudioContext to save resources
 */
export async function suspendAudioContext(): Promise<void> {
    if (audioContext && audioContext.state === 'running') {
        await audioContext.suspend();
    }
}

/**
 * Resume AudioContext
 */
export async function resumeAudioContext(): Promise<void> {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }
}

/**
 * Close AudioContext and release resources
 */
export async function closeAudioContext(): Promise<void> {
    if (audioContext) {
        // Clean up AudioWorklet
        if (workletManager) {
            workletManager.destroy();
            workletManager = null;
        }

        await audioContext.close();
        audioContext = null;
        gainNode = null;
    }
}

/**
 * Get current AudioContext state
 */
export function getAudioContextState(): AudioContextState | null {
    return audioContext?.state || null;
}

/**
 * Check if Web Audio API is supported
 */
export function isWebAudioSupported(): boolean {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
}

/**
 * Check if AudioWorklet is supported
 */
export function isAudioWorkletSupported(): boolean {
    return !!(window.AudioContext && (window.AudioContext.prototype as any).audioWorklet);
}

/**
 * Get AudioWorklet node for connecting to audio graph
 */
export function getWorkletNode(): AudioWorkletNode | null {
    const manager = getWorkletManager();
    if (manager) {
        return manager.getWorkletNode();
    }
    return null;
}
