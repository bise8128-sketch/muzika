/**
 * Echo Processor - Configurable echo/delay effect
 * Provides delay with feedback loop and stereo delay mode
 */

import { EchoSettings } from '../../types/audio';

export class EchoProcessor {
    private audioContext: AudioContext;
    private inputNode!: GainNode;
    private outputNode!: GainNode;
    private delayNode!: DelayNode;
    private feedbackNode!: GainNode;
    private wetGainNode!: GainNode;
    private dryGainNode!: GainNode;
    private bypassNode!: GainNode;

    // Stereo delay nodes
    private leftDelayNode!: DelayNode;
    private rightDelayNode!: DelayNode;
    private leftFeedbackNode!: GainNode;
    private rightFeedbackNode!: GainNode;
    private leftWetGainNode!: GainNode;
    private rightWetGainNode!: GainNode;
    private splitterNode!: ChannelSplitterNode;
    private mergerNode!: ChannelMergerNode;

    private settings: EchoSettings;
    private isInitialized: boolean = false;
    private isStereoMode: boolean = false;

    constructor(audioContext: AudioContext, settings?: Partial<EchoSettings>) {
        this.audioContext = audioContext;
        this.settings = {
            enabled: false,
            delayTime: 300,
            feedback: 0.3,
            wetLevel: 0.3,
            dryLevel: 0.7,
            stereoDelay: false,
            leftDelay: 300,
            rightDelay: 300,
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
        this.delayNode = this.audioContext.createDelay(1.0); // Max 1 second
        this.feedbackNode = this.audioContext.createGain();
        this.wetGainNode = this.audioContext.createGain();
        this.dryGainNode = this.audioContext.createGain();
        this.bypassNode = this.audioContext.createGain();

        // Stereo delay nodes
        this.leftDelayNode = this.audioContext.createDelay(1.0);
        this.rightDelayNode = this.audioContext.createDelay(1.0);
        this.leftFeedbackNode = this.audioContext.createGain();
        this.rightFeedbackNode = this.audioContext.createGain();
        this.leftWetGainNode = this.audioContext.createGain();
        this.rightWetGainNode = this.audioContext.createGain();
        this.splitterNode = this.audioContext.createChannelSplitter(2);
        this.mergerNode = this.audioContext.createChannelMerger(2);

        // Set initial values
        this.delayNode.delayTime.value = this.settings.delayTime / 1000;
        this.feedbackNode.gain.value = this.settings.feedback;
        this.wetGainNode.gain.value = this.settings.enabled ? this.settings.wetLevel : 0;
        this.dryGainNode.gain.value = this.settings.dryLevel;
        this.bypassNode.gain.value = 1.0;

        // Stereo delay initial values
        this.leftDelayNode.delayTime.value = this.settings.leftDelay / 1000;
        this.rightDelayNode.delayTime.value = this.settings.rightDelay / 1000;
        this.leftFeedbackNode.gain.value = this.settings.feedback;
        this.rightFeedbackNode.gain.value = this.settings.feedback;
        this.leftWetGainNode.gain.value = this.settings.enabled ? this.settings.wetLevel : 0;
        this.rightWetGainNode.gain.value = this.settings.enabled ? this.settings.wetLevel : 0;
    }

    /**
     * Build the audio graph
     */
    private buildAudioGraph(): void {
        this.updateAudioGraph();
    }

    /**
     * Update audio graph based on stereo mode
     */
    private updateAudioGraph(): void {
        // Disconnect all nodes first
        this.disconnectAll();

        if (this.settings.stereoDelay) {
            this.buildStereoGraph();
        } else {
            this.buildMonoGraph();
        }
    }

    /**
     * Build mono delay graph
     */
    private buildMonoGraph(): void {
        // Input -> Delay -> WetGain -> Output
        this.inputNode.connect(this.delayNode);
        this.delayNode.connect(this.wetGainNode);
        this.wetGainNode.connect(this.outputNode);

        // Delay -> Feedback -> Delay (feedback loop)
        this.delayNode.connect(this.feedbackNode);
        this.feedbackNode.connect(this.delayNode);

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
     * Build stereo delay graph
     */
    private buildStereoGraph(): void {
        // Input -> Splitter -> Left/Right channels
        this.inputNode.connect(this.splitterNode);

        // Left channel: Splitter -> LeftDelay -> LeftWetGain -> Merger
        this.splitterNode.connect(this.leftDelayNode, 0);
        this.leftDelayNode.connect(this.leftWetGainNode);
        this.leftWetGainNode.connect(this.mergerNode, 0, 0);

        // Left feedback loop
        this.leftDelayNode.connect(this.leftFeedbackNode);
        this.leftFeedbackNode.connect(this.leftDelayNode);

        // Right channel: Splitter -> RightDelay -> RightWetGain -> Merger
        this.splitterNode.connect(this.rightDelayNode, 1);
        this.rightDelayNode.connect(this.rightWetGainNode);
        this.rightWetGainNode.connect(this.mergerNode, 0, 1);

        // Right feedback loop
        this.rightDelayNode.connect(this.rightFeedbackNode);
        this.rightFeedbackNode.connect(this.rightDelayNode);

        // Cross-feedback (optional ping-pong effect)
        this.leftDelayNode.connect(this.rightFeedbackNode);
        this.rightDelayNode.connect(this.leftFeedbackNode);

        // Input -> DryGain -> Output (parallel path)
        this.inputNode.connect(this.dryGainNode);
        this.dryGainNode.connect(this.outputNode);

        // Merger -> Output
        this.mergerNode.connect(this.outputNode);

        // Bypass path (when disabled)
        this.inputNode.connect(this.bypassNode);
        this.bypassNode.connect(this.outputNode);
    }

    /**
     * Disconnect all nodes
     */
    private disconnectAll(): void {
        try {
            this.inputNode.disconnect();
            this.delayNode.disconnect();
            this.feedbackNode.disconnect();
            this.wetGainNode.disconnect();
            this.dryGainNode.disconnect();
            this.bypassNode.disconnect();
            this.leftDelayNode.disconnect();
            this.rightDelayNode.disconnect();
            this.leftFeedbackNode.disconnect();
            this.rightFeedbackNode.disconnect();
            this.leftWetGainNode.disconnect();
            this.rightWetGainNode.disconnect();
            this.splitterNode.disconnect();
            this.mergerNode.disconnect();
        } catch (e) {
            // Ignore disconnect errors
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
     * Update echo settings
     */
    setSettings(settings: Partial<EchoSettings>): void {
        const oldSettings = { ...this.settings };
        this.settings = { ...this.settings, ...settings };

        // Update wet/dry levels
        if (settings.wetLevel !== undefined) {
            this.wetGainNode.gain.value = this.settings.enabled ? this.settings.wetLevel : 0;
            this.leftWetGainNode.gain.value = this.settings.enabled ? this.settings.wetLevel : 0;
            this.rightWetGainNode.gain.value = this.settings.enabled ? this.settings.wetLevel : 0;
        }
        if (settings.dryLevel !== undefined) {
            this.dryGainNode.gain.value = this.settings.dryLevel;
        }

        // Update delay time
        if (settings.delayTime !== undefined) {
            const delayTime = Math.max(50, Math.min(1000, settings.delayTime));
            this.delayNode.delayTime.value = delayTime / 1000;
        }

        // Update feedback
        if (settings.feedback !== undefined) {
            const feedback = Math.max(0, Math.min(0.9, settings.feedback));
            this.feedbackNode.gain.value = feedback;
            this.leftFeedbackNode.gain.value = feedback;
            this.rightFeedbackNode.gain.value = feedback;
        }

        // Update stereo delay times
        if (settings.leftDelay !== undefined) {
            const leftDelay = Math.max(50, Math.min(1000, settings.leftDelay));
            this.leftDelayNode.delayTime.value = leftDelay / 1000;
        }
        if (settings.rightDelay !== undefined) {
            const rightDelay = Math.max(50, Math.min(1000, settings.rightDelay));
            this.rightDelayNode.delayTime.value = rightDelay / 1000;
        }

        // Update stereo mode
        if (settings.stereoDelay !== undefined && settings.stereoDelay !== oldSettings.stereoDelay) {
            this.updateAudioGraph();
        }

        // Update bypass state
        if (settings.enabled !== undefined) {
            this.updateBypass();
        }
    }

    /**
     * Update bypass state based on enabled setting
     */
    private updateBypass(): void {
        if (this.settings.enabled) {
            this.wetGainNode.gain.value = this.settings.wetLevel;
            this.leftWetGainNode.gain.value = this.settings.wetLevel;
            this.rightWetGainNode.gain.value = this.settings.wetLevel;
            this.bypassNode.gain.value = 0;
        } else {
            this.wetGainNode.gain.value = 0;
            this.leftWetGainNode.gain.value = 0;
            this.rightWetGainNode.gain.value = 0;
            this.bypassNode.gain.value = 1;
        }
    }

    /**
     * Enable or disable the echo effect
     */
    setEnabled(enabled: boolean): void {
        this.settings.enabled = enabled;
        this.updateBypass();
    }

    /**
     * Set delay time (50 to 1000ms)
     */
    setDelayTime(delayTime: number): void {
        this.settings.delayTime = Math.max(50, Math.min(1000, delayTime));
        this.delayNode.delayTime.value = this.settings.delayTime / 1000;
    }

    /**
     * Set feedback amount (0 to 0.9)
     */
    setFeedback(feedback: number): void {
        this.settings.feedback = Math.max(0, Math.min(0.9, feedback));
        this.feedbackNode.gain.value = this.settings.feedback;
        this.leftFeedbackNode.gain.value = this.settings.feedback;
        this.rightFeedbackNode.gain.value = this.settings.feedback;
    }

    /**
     * Set wet level (0 to 1)
     */
    setWetLevel(wetLevel: number): void {
        this.settings.wetLevel = Math.max(0, Math.min(1, wetLevel));
        if (this.settings.enabled) {
            this.wetGainNode.gain.value = this.settings.wetLevel;
            this.leftWetGainNode.gain.value = this.settings.wetLevel;
            this.rightWetGainNode.gain.value = this.settings.wetLevel;
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
     * Enable or disable stereo delay mode
     */
    setStereoDelay(stereoDelay: boolean): void {
        this.settings.stereoDelay = stereoDelay;
        this.updateAudioGraph();
    }

    /**
     * Set left delay time for stereo mode (50 to 1000ms)
     */
    setLeftDelay(leftDelay: number): void {
        this.settings.leftDelay = Math.max(50, Math.min(1000, leftDelay));
        this.leftDelayNode.delayTime.value = this.settings.leftDelay / 1000;
    }

    /**
     * Set right delay time for stereo mode (50 to 1000ms)
     */
    setRightDelay(rightDelay: number): void {
        this.settings.rightDelay = Math.max(50, Math.min(1000, rightDelay));
        this.rightDelayNode.delayTime.value = this.settings.rightDelay / 1000;
    }

    /**
     * Get current settings
     */
    getSettings(): EchoSettings {
        return { ...this.settings };
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
        this.disconnectAll();
        this.isInitialized = false;
    }
}
