/**
 * AudioContext initialization and management
 * Handles Web Audio API context creation and state management with AudioWorklet support
 * Uses AudioWorkletManager to wrap and manage the GenericAudioProcessor
 */

import { AudioWorkletManager } from './audioWorkletManager';
import { AudioContextError, AudioProcessingError } from '../../errors';

let audioContext: AudioContext | null = null;
let gainNode: GainNode | null = null;
let workletManager: AudioWorkletManager | null = null;
let isInteractionListenerAttached = false;

export interface WorkletMetrics {
    processingTime: number;
    memoryUsage: number;
    cpuUsage: number;
    count: number;
}

function setupUserInteractionListeners(ctx: AudioContext) {
    if (typeof window === 'undefined' || isInteractionListenerAttached) return;

    const resumeContext = () => {
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
                const events = ['click', 'touchstart', 'touchend', 'keydown'];
                events.forEach(event => document.removeEventListener(event, resumeContext));
                isInteractionListenerAttached = false;
            }).catch((err) => {
                const error = err as Error;
                console.warn('[AudioContext] Failed to resume on interaction', error);
            });
        } else if (ctx.state === 'running') {
            const events = ['click', 'touchstart', 'touchend', 'keydown'];
            events.forEach(event => document.removeEventListener(event, resumeContext));
            isInteractionListenerAttached = false;
        }
    };

    const events = ['click', 'touchstart', 'touchend', 'keydown'];
    events.forEach(event => document.addEventListener(event, resumeContext, { passive: true }));
    isInteractionListenerAttached = true;
}

/**
 * Initialize and get the global AudioContext
 * Sample rate: 44100 Hz (standard for audio processing)
 * Creates and initializes the AudioWorkletManager for real-time audio processing
 */
export function getAudioContext(): AudioContext {
    if (typeof window === 'undefined') {
        throw new AudioContextError('AudioContext is not supported on the server.', true);
    }

    if (!audioContext) {
        const AudioContextClass = (typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null) as typeof AudioContext | null;
        if (!AudioContextClass) {
            throw new AudioContextError('AudioContext is not supported in this browser.', true);
        }
        audioContext = new AudioContextClass({
            sampleRate: 44100,
            latencyHint: 'interactive',
        });

        // Create gain node for volume control
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);

        // Initialize AudioWorklet manager (wraps GenericAudioProcessor)
        workletManager = new AudioWorkletManager(audioContext);

        // Attach listeners to eagerly resume AudioContext on iOS Safari
        setupUserInteractionListeners(audioContext);
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
export function onWorkletMetricsUpdate(callback: (metrics: WorkletMetrics) => void): void {
    const manager = getWorkletManager();
    if (manager) {
        manager.onMetricsUpdate(callback);
    }
}

/**
 * Get average performance metrics from AudioWorklet
 */
export function getWorkletAverageMetrics(): WorkletMetrics | null {
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
    const context = getAudioContext();
    if (context.state === 'suspended') {
        try {
            await context.resume();
        } catch (err) {
            const error = err as Error;
            console.error('Failed to resume AudioContext. User interaction may be required.', error);
            throw new AudioContextError('Failed to resume AudioContext. User interaction required.');
        }
    }
}

/**
 * Close AudioContext and release all resources
 * This includes cleaning up the AudioWorkletManager and its resources
 */
export async function closeAudioContext(): Promise<void> {
    if (audioContext) {
        // Clean up AudioWorkletManager and its resources
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
    if (typeof window === 'undefined') return false;
    return !!(window.AudioContext || (window as any).webkitAudioContext);
}

/**
 * Check if AudioWorklet is supported
 */
export function isAudioWorkletSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    return !!(AudioContextClass && AudioContextClass.prototype.audioWorklet);
}

/**
 * Get AudioWorklet node for connecting to audio graph
 * This function is async and will initialize the AudioWorkletManager if needed
 * @returns AudioWorkletNode or null if not available
 */
export async function getWorkletNode(): Promise<AudioWorkletNode | null> {
    const manager = getWorkletManager();
    if (manager) {
        // Ensure the manager is initialized
        if (!manager.isInitialized()) {
            await manager.initialize();
        }
        return manager.getWorkletNode();
    }
    return null;
}

/**
 * Initialize microphone input stream
 */
export async function getMicrophoneStream(): Promise<MediaStream> {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        return stream;
    } catch (err) {
        console.error('[AudioContext] Failed to get microphone stream', err);
        throw new AudioProcessingError('Microphone access denied or not available.');
    }
}

/**
 * Create a PitchDetector node and load its worklet
 */
export async function createPitchDetectorNode(ctx: AudioContext): Promise<AudioWorkletNode> {
    try {
        const workletUrl = new URL('./pitchDetector.worklet.ts', import.meta.url);
        await ctx.audioWorklet.addModule(workletUrl);
        
        return new AudioWorkletNode(ctx, 'pitch-detector', {
            processorOptions: { sampleRate: ctx.sampleRate }
        });
    } catch (err) {
        console.error('[AudioContext] Failed to create pitch detector node', err);
        throw new AudioProcessingError('Failed to initialize pitch detection engine.');
    }
}
