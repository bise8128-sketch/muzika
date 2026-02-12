/**
 * PlaybackCore — Main playback engine.
 *
 * Composes EffectsChain + EventManager. Owns playback state, buffer source
 * lifecycle, seek, volume, and the deprecated ScriptProcessor fallback path.
 */

import { getAudioContext } from '../audioContext';
import { EffectsChain } from './EffectsChain';
import { EventManager, EventType, EventCallback } from './EventManager';
import type { ReverbSettings, EchoSettings, PitchCorrectionSettings } from '../../../types/audio';
import type { ReverbProcessor } from '../reverbProcessor';
import type { EchoProcessor } from '../echoProcessor';
import type { PitchCorrector } from '../pitchCorrection';

const BUFFER_SIZE = 4096;

export class PlaybackController {
    private audioContext: AudioContext;
    private effects: EffectsChain;
    private events: EventManager;

    // Sources
    private bufferSources: AudioBufferSourceNode[] = [];
    private gainNodes: GainNode[] = [];

    // Track state
    private audioBuffers: AudioBuffer[] = [];
    private voiceBuffer: AudioBuffer | null = null;
    private trackVolumes: number[] = [];
    private voiceVolume: number = 1.0;

    // Playback state
    private isPlaying: boolean = false;
    private isPaused: boolean = false;
    private playHead: number = 0;
    private startTime: number = 0;

    // Leftover samples for SoundTouch processing (deprecated)
    private leftoverLeft: Float32Array | null = null;
    private leftoverRight: Float32Array | null = null;
    private leftoverIndex: number = 0;

    constructor() {
        this.audioContext = getAudioContext();
        this.effects = new EffectsChain();
        this.events = new EventManager();

        // Wire time source for time-update loop
        this.events.setTimeSource(() => ({
            currentTime: this.getCurrentTime(),
            duration: this.getDuration(),
        }));

        // Init audio worklet
        this.effects.initializeAudioWorklet();
    }

    // ─── Buffer Management ─────────────────────────────────────────

    setAudioBuffers(buffers: AudioBuffer[]): void {
        this.stop();
        this.audioBuffers = buffers;
        this.trackVolumes = buffers.map(() => 1.0);
    }

    getAudioBuffers(): AudioBuffer[] {
        return this.audioBuffers;
    }

    setVoiceBuffer(buffer: AudioBuffer | null): void {
        this.voiceBuffer = buffer;
    }

    setVoiceVolume(volume: number): void {
        this.voiceVolume = Math.max(0, Math.min(1, volume));
    }

    // ─── Volume ────────────────────────────────────────────────────

    setVolume(volume: number, trackIndex?: number): void {
        const clamped = Math.max(0, Math.min(1, volume));
        if (trackIndex !== undefined) {
            this.trackVolumes[trackIndex] = clamped;
        } else {
            this.trackVolumes = this.trackVolumes.map(() => clamped);
        }
    }

    getVolume(trackIndex: number = 0): number {
        return this.trackVolumes[trackIndex] || 0;
    }

    getGainNodes(): GainNode[] { return []; }

    // ─── Transport ─────────────────────────────────────────────────

    play(): void {
        if (this.audioBuffers.length === 0) {
            console.warn('No audio buffers set for playback');
            return;
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        if (!this.isPlaying) {
            this.isPlaying = true;
            this.isPaused = false;
            this.stopAllSources();

            const currentTime = this.getCurrentTime();
            const destination = this.effects.getDestination();

            this.audioBuffers.forEach((buffer, index) => {
                const source = this.audioContext.createBufferSource();
                source.buffer = buffer;

                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = this.trackVolumes[index] || 1.0;

                source.connect(gainNode);
                gainNode.connect(destination);
                this.effects.connectSourceToEffects(gainNode);

                source.start(0, currentTime);
                source.onended = () => {
                    if (this.isPlaying) {
                        this.stop();
                        this.events.emit('ended');
                    }
                };

                this.bufferSources.push(source);
                this.gainNodes[index] = gainNode;
            });

            // Voice buffer
            if (this.voiceBuffer && this.voiceVolume > 0) {
                const voiceSource = this.audioContext.createBufferSource();
                voiceSource.buffer = this.voiceBuffer;

                const voiceGain = this.audioContext.createGain();
                voiceGain.gain.value = this.voiceVolume;

                voiceSource.connect(voiceGain);
                voiceGain.connect(destination);
                this.effects.connectSourceToEffects(voiceGain);

                voiceSource.start(0, currentTime);
                this.bufferSources.push(voiceSource);
            }

            this.startTime = this.audioContext.currentTime - currentTime;
            this.events.startTimeUpdateLoop();
            this.events.emit('play');
        }
    }

    pause(): void {
        if (!this.isPlaying) return;
        this.playHead = Math.floor(this.getCurrentTime() * this.audioContext.sampleRate);
        this.stopAllSources();
        this.isPlaying = false;
        this.isPaused = true;
        this.events.stopTimeUpdateLoop();
        this.events.emit('pause');
    }

    stop(): void {
        this.stopAllSources();
        this.isPlaying = false;
        this.isPaused = false;
        this.playHead = 0;
        this.effects.resetProcessor();
        this.events.stopTimeUpdateLoop();
        this.events.emit('stop');
    }

    private stopAllSources(): void {
        this.bufferSources.forEach(source => {
            try { source.stop(); source.disconnect(); } catch { /* may already be stopped */ }
        });
        this.bufferSources = [];
    }

    // ─── Seek / Time ───────────────────────────────────────────────

    setCurrentTime(seconds: number): void {
        const duration = this.getDuration();
        const clamped = Math.max(0, Math.min(seconds, duration));
        this.playHead = Math.floor(clamped * this.audioContext.sampleRate);
        this.effects.resetProcessor();
        this.events.emit('timeupdate', { currentTime: clamped, duration });
        this.events.emit('seeked', { currentTime: clamped });
    }

    getCurrentTime(): number {
        if (this.isPlaying && this.startTime > 0) {
            return this.audioContext.currentTime - this.startTime;
        } else if (this.audioBuffers.length > 0) {
            return this.playHead / this.audioContext.sampleRate;
        }
        return 0;
    }

    getDuration(): number {
        return this.audioBuffers[0]?.duration || 0;
    }

    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    // ─── Events (delegated) ────────────────────────────────────────

    on(event: EventType, callback: EventCallback): void { this.events.on(event, callback); }
    off(event: EventType, callback: EventCallback): void { this.events.off(event, callback); }

    // ─── Effects (delegated) ───────────────────────────────────────

    setPitch(semitones: number): void { this.effects.setPitch(semitones); }
    setTempo(multiplier: number): void { this.effects.setTempo(multiplier); }
    setReverbLevel(level: number): void { this.effects.setReverbLevel(level); }
    setEchoLevel(level: number): void { this.effects.setEchoLevel(level); }
    setMasterGain(gain: number): void { this.effects.setMasterGain(gain); }
    setBassGain(gain: number): void { this.effects.setBassGain(gain); }
    setMidGain(gain: number): void { this.effects.setMidGain(gain); }
    setTrebleGain(gain: number): void { this.effects.setTrebleGain(gain); }
    setEQ(bass: number, mid: number, treble: number): void { this.effects.setEQ(bass, mid, treble); }

    setReverbSettings(settings: Partial<ReverbSettings>): void { this.effects.setReverbSettings(settings); }
    getReverbSettings(): ReverbSettings { return this.effects.getReverbSettings(); }
    setReverbEnabled(enabled: boolean): void { this.effects.setReverbEnabled(enabled); }
    applyReverbPreset(preset: 'hall' | 'room' | 'plate' | 'chamber' | 'spring'): void { this.effects.applyReverbPreset(preset); }

    setEchoSettings(settings: Partial<EchoSettings>): void { this.effects.setEchoSettings(settings); }
    getEchoSettings(): EchoSettings { return this.effects.getEchoSettings(); }
    setEchoEnabled(enabled: boolean): void { this.effects.setEchoEnabled(enabled); }
    setStereoDelayEnabled(enabled: boolean): void { this.effects.setStereoDelayEnabled(enabled); }

    async setPitchCorrectionSettings(settings: Partial<PitchCorrectionSettings>): Promise<void> { return this.effects.setPitchCorrectionSettings(settings); }
    getPitchCorrectionSettings(): PitchCorrectionSettings { return this.effects.getPitchCorrectionSettings(); }
    async setPitchCorrectionEnabled(enabled: boolean): Promise<void> { return this.effects.setPitchCorrectionEnabled(enabled); }
    async setPitchCorrectionScale(scale: 'chromatic' | 'major' | 'minor' | 'pentatonic-major' | 'pentatonic-minor'): Promise<void> { return this.effects.setPitchCorrectionScale(scale); }
    async setPitchCorrectionReferenceKey(referenceKey: number): Promise<void> { return this.effects.setPitchCorrectionReferenceKey(referenceKey); }
    async setPitchCorrectionRetuneSpeed(retuneSpeed: number): Promise<void> { return this.effects.setPitchCorrectionRetuneSpeed(retuneSpeed); }
    async setPitchCorrectionAmount(correctionAmount: number): Promise<void> { return this.effects.setPitchCorrectionAmount(correctionAmount); }

    getReverbProcessor(): ReverbProcessor { return this.effects.getReverbProcessor(); }
    getEchoProcessor(): EchoProcessor { return this.effects.getEchoProcessor(); }
    getPitchCorrector(): PitchCorrector { return this.effects.getPitchCorrector(); }

    // ─── Deprecated ScriptProcessor path ───────────────────────────

    private handleAudioProcess(_e: AudioProcessingEvent): void {
        if (!this.isPlaying) return;

        const outputL = _e.outputBuffer.getChannelData(0);
        const outputR = _e.outputBuffer.getChannelData(1);

        const generatedL = new Float32Array(BUFFER_SIZE);
        const generatedR = new Float32Array(BUFFER_SIZE);
        let generatedCount = 0;

        let loopCount = 0;
        const maxLoops = 20;

        // Consume leftover samples
        if (this.leftoverLeft && this.leftoverRight && this.leftoverIndex < this.leftoverLeft.length) {
            const leftoverAvailable = this.leftoverLeft.length - this.leftoverIndex;
            const toCopy = Math.min(leftoverAvailable, BUFFER_SIZE);

            for (let k = 0; k < toCopy; k++) {
                generatedL[k] = this.leftoverLeft[this.leftoverIndex + k];
                generatedR[k] = this.leftoverRight[this.leftoverIndex + k];
            }
            generatedCount += toCopy;
            this.leftoverIndex += toCopy;

            if (this.leftoverIndex >= this.leftoverLeft.length) {
                this.leftoverLeft = null;
                this.leftoverRight = null;
                this.leftoverIndex = 0;
            }
        }

        while (generatedCount < BUFFER_SIZE && loopCount < maxLoops) {
            loopCount++;
            const feedSize = BUFFER_SIZE;
            const tempo = this.effects.getTempo();
            const effectiveDuration = this.getDuration() / tempo;

            if (this.playHead >= effectiveDuration * this.audioContext.sampleRate) break;

            const inputL = new Float32Array(feedSize);
            const inputR = new Float32Array(feedSize);
            let activeTracks = 0;

            for (let i = 0; i < this.audioBuffers.length; i++) {
                const buffer = this.audioBuffers[i];
                const vol = this.trackVolumes[i];
                if (vol > 0 && buffer && this.playHead < buffer.length) {
                    activeTracks++;
                    const chL = buffer.getChannelData(0);
                    const chR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : chL;
                    for (let s = 0; s < feedSize; s++) {
                        const idx = this.playHead + s;
                        if (idx < buffer.length) {
                            inputL[s] += chL[idx] * vol;
                            inputR[s] += chR[idx] * vol;
                        }
                    }
                }
            }

            // Voice track
            if (this.voiceBuffer && this.voiceVolume > 0 && this.playHead < this.voiceBuffer.length) {
                activeTracks++;
                const chL = this.voiceBuffer.getChannelData(0);
                const chR = this.voiceBuffer.numberOfChannels > 1 ? this.voiceBuffer.getChannelData(1) : chL;
                for (let s = 0; s < feedSize; s++) {
                    const idx = this.playHead + s;
                    if (idx < this.voiceBuffer.length) {
                        inputL[s] += chL[idx] * this.voiceVolume;
                        inputR[s] += chR[idx] * this.voiceVolume;
                    }
                }
            }

            this.playHead += Math.floor(feedSize / tempo);

            const processed = this.effects.processor.process(inputL, inputR);

            if (processed) {
                const available = processed.left.length;
                const needed = BUFFER_SIZE - generatedCount;
                const toCopy = Math.min(available, needed);

                for (let k = 0; k < toCopy; k++) {
                    generatedL[generatedCount + k] = processed.left[k];
                    generatedR[generatedCount + k] = processed.right[k];
                }
                generatedCount += toCopy;

                if (available > needed) {
                    const excessCount = available - needed;
                    this.leftoverLeft = new Float32Array(excessCount);
                    this.leftoverRight = new Float32Array(excessCount);
                    this.leftoverIndex = 0;
                    for (let k = 0; k < excessCount; k++) {
                        this.leftoverLeft[k] = processed.left[needed + k];
                        this.leftoverRight[k] = processed.right[needed + k];
                    }
                }
            }

            if (activeTracks === 0 && generatedCount < BUFFER_SIZE) {
                if (!this.leftoverLeft && !this.leftoverRight) {
                    this.stop();
                    this.events.emit('ended');
                    break;
                }
            }
        }

        outputL.set(generatedL);
        outputR.set(generatedR);
    }

    // ─── Dispose ───────────────────────────────────────────────────

    dispose(): void {
        this.stop();
        this.events.dispose();
        this.effects.dispose();
        this.audioBuffers = [];
    }
}
