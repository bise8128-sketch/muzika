/**
 * Reverb Processor - Algorithmic reverb with ConvolverNode
 * Provides synthetic impulse responses and configurable reverb parameters
 */

import { ReverbSettings } from '../../types/audio';

export interface ReverbPreset {
    name: string;
    decay: number;
    preDelay: number;
    wetLevel: number;
    dryLevel: number;
    roomSize: 'small' | 'medium' | 'large' | 'hall';
}

export class ReverbProcessor {
    private audioContext: AudioContext;
    private convolverNode!: ConvolverNode;
    private wetGainNode!: GainNode;
    private dryGainNode!: GainNode;
    private inputNode!: GainNode;
    private outputNode!: GainNode;
    private preDelayNode!: DelayNode;
    private bypassNode!: GainNode;
    private settings: ReverbSettings;
    private isInitialized: boolean = false;

    // Preset configurations
    private static readonly PRESETS: Record<string, ReverbPreset> = {
        hall: {
            name: 'Hall',
            decay: 3.5,
            preDelay: 40,
            wetLevel: 0.4,
            dryLevel: 0.6,
            roomSize: 'hall'
        },
        room: {
            name: 'Room',
            decay: 1.2,
            preDelay: 10,
            wetLevel: 0.3,
            dryLevel: 0.7,
            roomSize: 'medium'
        },
        plate: {
            name: 'Plate',
            decay: 2.0,
            preDelay: 5,
            wetLevel: 0.35,
            dryLevel: 0.65,
            roomSize: 'medium'
        },
        chamber: {
            name: 'Chamber',
            decay: 1.8,
            preDelay: 20,
            wetLevel: 0.25,
            dryLevel: 0.75,
            roomSize: 'large'
        },
        spring: {
            name: 'Spring',
            decay: 0.8,
            preDelay: 0,
            wetLevel: 0.2,
            dryLevel: 0.8,
            roomSize: 'small'
        }
    };

    constructor(audioContext: AudioContext, settings?: Partial<ReverbSettings>) {
        this.audioContext = audioContext;
        this.settings = {
            enabled: false,
            decay: 2.0,
            roomSize: 'medium',
            preDelay: 20,
            wetLevel: 0.3,
            dryLevel: 0.7,
            preset: 'room',
            ...settings
        };

        this.initializeNodes();
        this.buildAudioGraph();
        this.isInitialized = true;
    }

    /**
     * Initialize all audio nodes
     */
    private initializeNodes(): void {
        this.inputNode = this.audioContext.createGain();
        this.outputNode = this.audioContext.createGain();
        this.convolverNode = this.audioContext.createConvolver();
        this.wetGainNode = this.audioContext.createGain();
        this.dryGainNode = this.audioContext.createGain();
        this.preDelayNode = this.audioContext.createDelay(0.2); // Max 200ms
        this.bypassNode = this.audioContext.createGain();

        // Set initial values
        this.wetGainNode.gain.value = this.settings.enabled ? this.settings.wetLevel : 0;
        this.dryGainNode.gain.value = this.settings.dryLevel;
        this.preDelayNode.delayTime.value = this.settings.preDelay / 1000;
        this.bypassNode.gain.value = 1.0;

        // Create initial impulse response
        this.updateImpulseResponse();
    }

    /**
     * Build the audio graph
     */
    private buildAudioGraph(): void {
        // Input -> PreDelay -> Convolver -> WetGain -> Output
        this.inputNode.connect(this.preDelayNode);
        this.preDelayNode.connect(this.convolverNode);
        this.convolverNode.connect(this.wetGainNode);
        this.wetGainNode.connect(this.outputNode);

        // Input -> DryGain -> Output (parallel path)
        this.inputNode.connect(this.dryGainNode);
        this.dryGainNode.connect(this.outputNode);

        // Bypass path (only connect when disabled)
        if (!this.settings.enabled) {
            this.inputNode.connect(this.bypassNode);
            this.bypassNode.connect(this.outputNode);
        }
    }

    /**
     * Generate synthetic impulse response based on settings
     */
    private updateImpulseResponse(): void {
        const sampleRate = this.audioContext.sampleRate;
        const decayTime = this.settings.decay;
        const roomSize = this.settings.roomSize;

        // Calculate impulse length based on room size and decay
        const roomSizeMultipliers: Record<string, number> = {
            small: 0.5,
            medium: 1.0,
            large: 1.5,
            hall: 2.0
        };

        const length = Math.floor(sampleRate * decayTime * roomSizeMultipliers[roomSize]);
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);

        // Generate impulse response for each channel
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            this.generateImpulseData(data, sampleRate, decayTime, channel);
        }

        this.convolverNode.buffer = impulse;
    }

    /**
     * Generate impulse response data for a single channel
     */
    private generateImpulseData(
        data: Float32Array,
        sampleRate: number,
        decayTime: number,
        channel: number
    ): void {
        const length = data.length;

        // Different room characteristics based on room size
        const roomSize = this.settings.roomSize;
        let density: number;
        let diffusion: number;

        switch (roomSize) {
            case 'small':
                density = 0.3;
                diffusion = 0.5;
                break;
            case 'medium':
                density = 0.5;
                diffusion = 0.7;
                break;
            case 'large':
                density = 0.7;
                diffusion = 0.85;
                break;
            case 'hall':
                density = 0.9;
                diffusion = 0.95;
                break;
            default:
                density = 0.5;
                diffusion = 0.7;
        }

        // Generate noise with exponential decay
        for (let i = 0; i < length; i++) {
            const time = i / sampleRate;
            const decay = Math.exp(-3 * time / decayTime);

            // Add some early reflections - fixed to trigger on ranges, not single samples
            let earlyReflections = 0;
            if (i < sampleRate * 0.1) {
                const reflectionTimes = [0.01, 0.02, 0.03, 0.05, 0.07];
                for (const t of reflectionTimes) {
                    const idx = Math.floor(t * sampleRate);
                    // Check if current sample is within a small window around the reflection time
                    if (Math.abs(i - idx) < 50) {
                        earlyReflections += (Math.random() * 2 - 1) * 0.5;
                    }
                }
            }

            // Main reverb tail
            const noise = (Math.random() * 2 - 1) * decay;

            // Add some tonal characteristics based on channel
            const tonal = Math.sin(2 * Math.PI * (channel === 0 ? 440 : 880) * time) * decay * 0.1;

            // Combine all components
            data[i] = (noise * density + earlyReflections * diffusion + tonal) * 0.5;
        }

        // Normalize the impulse response
        this.normalizeBuffer(data);
    }

    /**
     * Normalize buffer to prevent clipping
     */
    private normalizeBuffer(data: Float32Array): void {
        let maxAmplitude = 0;
        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > maxAmplitude) {
                maxAmplitude = abs;
            }
        }

        if (maxAmplitude > 0) {
            const scale = 0.9 / maxAmplitude;
            for (let i = 0; i < data.length; i++) {
                data[i] *= scale;
            }
        }
    }

    /**
     * Get input node for connecting audio sources
     */
    getInput(): AudioNode {
        return this.inputNode;
    }

    /**
     * Get output node for connecting to destination
     */
    getOutput(): AudioNode {
        return this.outputNode;
    }

    /**
     * Update reverb settings
     */
    setSettings(settings: Partial<ReverbSettings>): void {
        const oldSettings = { ...this.settings };
        this.settings = { ...this.settings, ...settings };

        // Update wet/dry levels
        if (settings.wetLevel !== undefined) {
            this.wetGainNode.gain.value = this.settings.enabled ? this.settings.wetLevel : 0;
        }
        if (settings.dryLevel !== undefined) {
            this.dryGainNode.gain.value = this.settings.dryLevel;
        }

        // Update pre-delay
        if (settings.preDelay !== undefined) {
            this.preDelayNode.delayTime.value = Math.max(0, Math.min(200, settings.preDelay)) / 1000;
        }

        // Update impulse response if decay or room size changed
        if (settings.decay !== undefined || settings.roomSize !== undefined) {
            this.updateImpulseResponse();
        }

        // Update bypass state
        if (settings.enabled !== undefined) {
            this.updateBypass();
        }

        // Apply preset if specified
        if (settings.preset !== undefined && settings.preset !== oldSettings.preset) {
            this.applyPreset(settings.preset);
        }
    }

    /**
     * Apply a preset configuration
     */
    applyPreset(presetName: string): void {
        const preset = ReverbProcessor.PRESETS[presetName];
        if (!preset) {
            console.warn(`Unknown reverb preset: ${presetName}`);
            return;
        }

        this.settings = {
            ...this.settings,
            decay: preset.decay,
            preDelay: preset.preDelay,
            wetLevel: preset.wetLevel,
            dryLevel: preset.dryLevel,
            roomSize: preset.roomSize,
            preset: presetName as 'hall' | 'room' | 'plate' | 'chamber' | 'spring'
        };

        // Update all parameters
        this.wetGainNode.gain.value = this.settings.enabled ? this.settings.wetLevel : 0;
        this.dryGainNode.gain.value = this.settings.dryLevel;
        this.preDelayNode.delayTime.value = this.settings.preDelay / 1000;
        this.updateImpulseResponse();
    }

    /**
     * Update bypass state based on enabled setting
     */
    private updateBypass(): void {
        if (this.settings.enabled) {
            this.wetGainNode.gain.value = this.settings.wetLevel;
            this.bypassNode.gain.value = 0;
        } else {
            this.wetGainNode.gain.value = 0;
            this.bypassNode.gain.value = 1;
        }
    }

    /**
     * Enable or disable the reverb effect
     */
    setEnabled(enabled: boolean): void {
        this.settings.enabled = enabled;
        this.updateBypass();
    }

    /**
     * Set decay time (0.1 to 10 seconds)
     */
    setDecay(decay: number): void {
        this.settings.decay = Math.max(0.1, Math.min(10, decay));
        this.updateImpulseResponse();
    }

    /**
     * Set room size
     */
    setRoomSize(roomSize: 'small' | 'medium' | 'large' | 'hall'): void {
        this.settings.roomSize = roomSize;
        this.updateImpulseResponse();
    }

    /**
     * Set pre-delay (0 to 200ms)
     */
    setPreDelay(preDelay: number): void {
        this.settings.preDelay = Math.max(0, Math.min(200, preDelay));
        this.preDelayNode.delayTime.value = this.settings.preDelay / 1000;
    }

    /**
     * Set wet level (0 to 1)
     */
    setWetLevel(wetLevel: number): void {
        this.settings.wetLevel = Math.max(0, Math.min(1, wetLevel));
        if (this.settings.enabled) {
            this.wetGainNode.gain.value = this.settings.wetLevel;
        }
    }

    /**
     * Set dry level (0 to 1)
     */
    setDryLevel(dryLevel: number): void {
        this.settings.dryLevel = Math.max(0, Math.min(1, dryLevel));
        this.dryGainNode.gain.value = this.settings.dryLevel;
    }

    /**
     * Get current settings
     */
    getSettings(): ReverbSettings {
        return { ...this.settings };
    }

    /**
     * Get available presets
     */
    static getPresets(): ReverbPreset[] {
        return Object.values(ReverbProcessor.PRESETS);
    }

    /**
     * Check if the processor is initialized
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        this.inputNode.disconnect();
        this.outputNode.disconnect();
        this.convolverNode.disconnect();
        this.wetGainNode.disconnect();
        this.dryGainNode.disconnect();
        this.preDelayNode.disconnect();
        this.bypassNode.disconnect();
        this.isInitialized = false;
    }
}
