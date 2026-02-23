/**
 * EffectsChain — Manages the entire audio effects graph.
 *
 * Owns: EQ (bass/mid/treble), reverb, echo, pitch correction, pitch/tempo,
 *       master gain, and the signal routing chain.
 */

import { getAudioContext } from '../audioContext';
import { RealtimeAudioProcessor } from '../pitchTempo';
import { ReverbProcessor } from '../reverbProcessor';
import { EchoProcessor } from '../echoProcessor';
import { PitchCorrector } from '../pitchCorrection';
import { ReverbSettings, EchoSettings, PitchCorrectionSettings } from '../../../types/audio';

export class EffectsChain {
    private audioContext: AudioContext;

    // DSP processor for pitch/tempo
    readonly processor: RealtimeAudioProcessor;
    private workletNode: AudioWorkletNode | null = null;

    // New Effect Processors
    private reverbProcessor: ReverbProcessor;
    private echoProcessor: EchoProcessor;
    private pitchCorrector: PitchCorrector;

    // Legacy Effects (backward compatibility)
    private reverbNode: ConvolverNode;
    private reverbGain: GainNode;
    private echoNode: DelayNode;
    private echoFeedback: GainNode;
    private echoGain: GainNode;

    // EQ & Master
    readonly masterGain: GainNode;
    private bassNode: BiquadFilterNode;
    private midNode: BiquadFilterNode;
    private trebleNode: BiquadFilterNode;

    // Stored pitch/tempo for reset recovery
    private pitch: number = 0;
    private tempo: number = 1.0;

    // Master Dynamics
    private compressorNode: DynamicsCompressorNode;

    constructor() {
        this.audioContext = getAudioContext();
        this.processor = new RealtimeAudioProcessor(this.audioContext.sampleRate);

        // New effect processors
        this.reverbProcessor = new ReverbProcessor(this.audioContext);
        this.echoProcessor = new EchoProcessor(this.audioContext);
        this.pitchCorrector = new PitchCorrector(this.audioContext);

        // Legacy Effects
        this.reverbNode = this.audioContext.createConvolver();
        this.reverbGain = this.audioContext.createGain();
        this.reverbGain.gain.value = 0;

        this.echoNode = this.audioContext.createDelay();
        this.echoFeedback = this.audioContext.createGain();
        this.echoGain = this.audioContext.createGain();

        // Master Dynamics
        this.compressorNode = this.audioContext.createDynamicsCompressor();
        this.compressorNode.threshold.value = -24;
        this.compressorNode.knee.value = 30;
        this.compressorNode.ratio.value = 12;
        this.compressorNode.attack.value = 0.003;
        this.compressorNode.release.value = 0.25;

        // EQ & Master
        this.masterGain = this.audioContext.createGain();
        this.bassNode = this.audioContext.createBiquadFilter();
        this.midNode = this.audioContext.createBiquadFilter();
        this.trebleNode = this.audioContext.createBiquadFilter();

        // EQ Config
        this.bassNode.type = 'lowshelf';
        this.bassNode.frequency.value = 200;
        this.bassNode.gain.value = 0;

        this.midNode.type = 'peaking';
        this.midNode.frequency.value = 1000;
        this.midNode.Q.value = 0.7;
        this.midNode.gain.value = 0;

        this.trebleNode.type = 'highshelf';
        this.trebleNode.frequency.value = 3000;
        this.trebleNode.gain.value = 0;

        // Master Chain: masterGain -> compressor -> bass -> mid -> treble -> destination
        this.masterGain.connect(this.compressorNode);
        this.compressorNode.connect(this.bassNode);
        this.bassNode.connect(this.midNode);
        this.midNode.connect(this.trebleNode);
        this.trebleNode.connect(this.audioContext.destination);

        // Echo config
        this.echoNode.delayTime.value = 0.3;
        this.echoFeedback.gain.value = 0.4;
        this.echoGain.gain.value = 0;

        // Reverb Chain
        this.reverbNode.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);

        // Echo Chain
        this.echoNode.connect(this.echoGain);
        this.echoGain.connect(this.masterGain);
        this.echoNode.connect(this.echoFeedback);
        this.echoFeedback.connect(this.echoNode);

        this.createImpulseResponse();
    }

    /** Initialise AudioWorklet and wire it into the effects chain. */
    async initializeAudioWorklet(): Promise<void> {
        try {
            await this.processor.initialize(this.audioContext);
            this.workletNode = this.processor.getNode();

            if (this.workletNode) {
                this.workletNode.connect(this.masterGain);
                this.workletNode.connect(this.reverbNode);
                this.workletNode.connect(this.echoNode);
            }

            const reverbOutput = this.reverbProcessor.getOutput();
            const echoOutput = this.echoProcessor.getOutput();
            if (reverbOutput) reverbOutput.connect(this.masterGain);
            if (echoOutput) echoOutput.connect(this.masterGain);
        } catch (error) {
            console.warn('AudioWorklet initialization failed, using direct playback:', error);
        }
    }

    /** The destination node that playback sources should connect to. */
    getDestination(): AudioNode {
        return this.workletNode || this.masterGain;
    }

    hasWorklet(): boolean {
        return this.workletNode !== null;
    }

    getReverbInput(): AudioNode | null {
        return this.reverbProcessor.getInput() || this.reverbNode;
    }

    getEchoInput(): AudioNode | null {
        return this.echoProcessor.getInput() || this.echoNode;
    }

    /** Connect a source node into the legacy & new effects. */
    connectSourceToEffects(sourceNode: AudioNode): void {
        const reverbInput = this.reverbProcessor.getInput();
        const echoInput = this.echoProcessor.getInput();
        if (reverbInput) sourceNode.connect(reverbInput);
        if (echoInput) sourceNode.connect(echoInput);
        if (this.pitchCorrector.isReady()) {
            const pitchInput = this.pitchCorrector.getInput();
            if (pitchInput) sourceNode.connect(pitchInput);
        }
        if (!this.workletNode) {
            sourceNode.connect(this.reverbNode);
            sourceNode.connect(this.echoNode);
        }
    }

    // --- Pitch / Tempo ---

    setPitch(semitones: number): void {
        this.pitch = semitones;
        this.processor.setPitchSemitones(semitones);
    }

    setTempo(multiplier: number): void {
        this.tempo = multiplier;
        this.processor.setTempo(multiplier);
    }

    getPitch(): number { return this.pitch; }
    getTempo(): number { return this.tempo; }

    /** Reset the processor and re-apply pitch/tempo. */
    resetProcessor(): void {
        this.processor.reset();
        this.processor.setPitchSemitones(this.pitch);
        this.processor.setTempo(this.tempo);
    }

    // --- Reverb ---

    setReverbLevel(level: number): void {
        this.reverbGain.gain.value = Math.max(0, Math.min(1, level));
    }

    setReverbSettings(settings: Partial<ReverbSettings>): void {
        this.reverbProcessor.setSettings(settings);
    }

    getReverbSettings(): ReverbSettings {
        return this.reverbProcessor.getSettings();
    }

    setReverbEnabled(enabled: boolean): void {
        this.reverbProcessor.setEnabled(enabled);
    }

    applyReverbPreset(preset: 'hall' | 'room' | 'plate' | 'chamber' | 'spring'): void {
        this.reverbProcessor.applyPreset(preset);
    }

    getReverbProcessor(): ReverbProcessor {
        return this.reverbProcessor;
    }

    // --- Echo ---

    setEchoLevel(level: number): void {
        this.echoGain.gain.value = Math.max(0, Math.min(1, level));
    }

    setEchoSettings(settings: Partial<EchoSettings>): void {
        this.echoProcessor.setSettings(settings);
    }

    getEchoSettings(): EchoSettings {
        return this.echoProcessor.getSettings();
    }

    setEchoEnabled(enabled: boolean): void {
        this.echoProcessor.setEnabled(enabled);
    }

    setStereoDelayEnabled(enabled: boolean): void {
        this.echoProcessor.setStereoDelay(enabled);
    }

    getEchoProcessor(): EchoProcessor {
        return this.echoProcessor;
    }

    // --- EQ ---

    setMasterGain(gain: number): void { this.masterGain.gain.value = gain; }
    setBassGain(gain: number): void { this.bassNode.gain.value = gain; }
    setMidGain(gain: number): void { this.midNode.gain.value = gain; }
    setTrebleGain(gain: number): void { this.trebleNode.gain.value = gain; }

    setEQ(bass: number, mid: number, treble: number): void {
        this.bassNode.gain.value = bass;
        this.midNode.gain.value = mid;
        this.trebleNode.gain.value = treble;
    }

    // --- Pitch Correction ---

    async setPitchCorrectionSettings(settings: Partial<PitchCorrectionSettings>): Promise<void> {
        if (!this.pitchCorrector.isReady()) await this.pitchCorrector.initialize();
        this.pitchCorrector.setSettings(settings);
    }

    getPitchCorrectionSettings(): PitchCorrectionSettings {
        return this.pitchCorrector.getSettings();
    }

    async setPitchCorrectionEnabled(enabled: boolean): Promise<void> {
        if (!this.pitchCorrector.isReady()) await this.pitchCorrector.initialize();
        this.pitchCorrector.setEnabled(enabled);
    }

    async setPitchCorrectionScale(scale: 'chromatic' | 'major' | 'minor' | 'pentatonic-major' | 'pentatonic-minor'): Promise<void> {
        if (!this.pitchCorrector.isReady()) await this.pitchCorrector.initialize();
        this.pitchCorrector.setScale(scale);
    }

    async setPitchCorrectionReferenceKey(referenceKey: number): Promise<void> {
        if (!this.pitchCorrector.isReady()) await this.pitchCorrector.initialize();
        this.pitchCorrector.setReferenceKey(referenceKey);
    }

    async setPitchCorrectionRetuneSpeed(retuneSpeed: number): Promise<void> {
        if (!this.pitchCorrector.isReady()) await this.pitchCorrector.initialize();
        this.pitchCorrector.setRetuneSpeed(retuneSpeed);
    }

    async setPitchCorrectionAdaptiveMode(enabled: boolean): Promise<void> {
        if (!this.pitchCorrector.isReady()) await this.pitchCorrector.initialize();
        this.pitchCorrector.setAdaptiveMode(enabled);
    }

    async setPitchCorrectionAmount(correctionAmount: number): Promise<void> {
        if (!this.pitchCorrector.isReady()) await this.pitchCorrector.initialize();
        this.pitchCorrector.setCorrectionAmount(correctionAmount);
    }

    getPitchCorrector(): PitchCorrector {
        return this.pitchCorrector;
    }

    // --- Internal ---

    private createImpulseResponse(): void {
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * 2.0;
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const decay = Math.pow(1 - i / length, 2);
                data[i] = (Math.random() * 2 - 1) * decay;
            }
        }
        this.reverbNode.buffer = impulse;
    }

    dispose(): void {
        this.processor.dispose();
        this.reverbProcessor.destroy();
        this.echoProcessor.destroy();
        this.pitchCorrector.destroy();
        this.compressorNode.disconnect();
    }
}
