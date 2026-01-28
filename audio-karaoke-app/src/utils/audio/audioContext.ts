/**
 * AudioContext initialization and management
 * Handles Web Audio API context creation and state management
 */

let audioContext: AudioContext | null = null;
let gainNode: GainNode | null = null;

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
 * Set master volume
 * @param volume - Volume level (0.0 to 1.0)
 */
export function setVolume(volume: number): void {
    const gain = getGainNode();
    gain.gain.value = Math.max(0, Math.min(1, volume));
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
