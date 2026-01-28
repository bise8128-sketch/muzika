/**
 * Playback Controller for Audio
 * Manages playback of AudioBuffers with event system and controls
 * Refactored to use ScriptProcessorNode + SoundTouchJS for decoupled Pitch/Tempo
 */

import { getAudioContext } from './audioContext';
import { RealtimeAudioProcessor } from './pitchTempo';

type EventType = 'play' | 'pause' | 'stop' | 'timeupdate' | 'ended';
type EventCallback = (data?: any) => void;

const BUFFER_SIZE = 4096;

export class PlaybackController {
    private audioContext: AudioContext;
    private scriptNode: ScriptProcessorNode | null = null;
    private processor: RealtimeAudioProcessor;

    // Effects
    private reverbNode: ConvolverNode;
    private reverbGain: GainNode;
    private echoNode: DelayNode;
    private echoFeedback: GainNode;
    private echoGain: GainNode;

    // EQ & Master
    private masterGain: GainNode;
    private bassNode: BiquadFilterNode;
    private midNode: BiquadFilterNode;
    private trebleNode: BiquadFilterNode;

    // Track state
    private audioBuffers: AudioBuffer[] = [];
    private voiceBuffer: AudioBuffer | null = null;
    private gainNodes: GainNode[] = []; // Not used for direct connection anymore, but keeping for volume state
    private trackVolumes: number[] = [];
    private voiceVolume: number = 1.0;

    // Playback state
    private isPlaying: boolean = false;
    private isPaused: boolean = false;
    private playHead: number = 0; // Current sample index
    private startTime: number = 0; // For time synchronization if needed, mostly redundant with playHead

    private listeners: Map<EventType, EventCallback[]> = new Map();
    private updateInterval: number | null = null;

    private pitch: number = 0; // Semitones
    private tempo: number = 1.0; // Rate

    // Buffer overflow handling - stores excess samples from SoundTouch processing
    private leftoverLeft: Float32Array | null = null;
    private leftoverRight: Float32Array | null = null;
    private leftoverIndex: number = 0;

    constructor() {
        this.audioContext = getAudioContext();
        this.processor = new RealtimeAudioProcessor(this.audioContext.sampleRate);

        // Initialize Effects Graph
        this.reverbNode = this.audioContext.createConvolver();
        this.reverbGain = this.audioContext.createGain();
        this.reverbGain.gain.value = 0; // Default dry

        this.echoNode = this.audioContext.createDelay();
        this.echoFeedback = this.audioContext.createGain();
        this.echoGain = this.audioContext.createGain();

        // Echo config
        this.echoNode.delayTime.value = 0.3; // 300ms default
        this.echoFeedback.gain.value = 0.4;
        this.echoGain.gain.value = 0; // Default dry

        // Connect Effects: Effects -> Destination
        // We will connect ScriptNode -> Effects -> Destination

        // Reverb Chain
        this.reverbNode.connect(this.reverbGain);
        this.reverbGain.connect(this.audioContext.destination);

        // Echo Chain
        this.echoNode.connect(this.echoGain);
        this.echoGain.connect(this.audioContext.destination);
        this.echoNode.connect(this.echoFeedback);
        this.echoFeedback.connect(this.echoNode);

        // Master Gain Node
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 1.0; // Default 0 dB
        this.masterGain.connect(this.audioContext.destination);

        // EQ Nodes
        this.bassNode = this.audioContext.createBiquadFilter();
        this.bassNode.type = 'lowshelf';
        this.bassNode.frequency.value = 200; // 200 Hz
        this.bassNode.gain.value = 0; // Default flat

        this.midNode = this.audioContext.createBiquadFilter();
        this.midNode.type = 'peaking';
        this.midNode.frequency.value = 1000; // 1 kHz
        this.midNode.gain.value = 0; // Default flat

        this.trebleNode = this.audioContext.createBiquadFilter();
        this.trebleNode.type = 'highshelf';
        this.trebleNode.frequency.value = 5000; // 5 kHz
        this.trebleNode.gain.value = 0; // Default flat

        // Connect EQ: Source -> Bass -> Mid -> Treble -> Destination
        // We will connect ScriptNode -> EQ -> Master Gain -> Destination

        this.bassNode.connect(this.midNode);
        this.midNode.connect(this.trebleNode);
        this.trebleNode.connect(this.masterGain);

        this.createImpulseResponse();
    }

    private createImpulseResponse() {
        // Simple synthetic reverb (decaying noise)
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * 2.0; // 2 seconds
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // Exponential decay
                const decay = Math.pow(1 - i / length, 2);
                data[i] = (Math.random() * 2 - 1) * decay;
            }
        }
        this.reverbNode.buffer = impulse;
    }

    /**
     * Set audio buffers for playback (supports multiple tracks)
     * @param buffers - Array of AudioBuffers to play simultaneously
     */
    setAudioBuffers(buffers: AudioBuffer[]): void {
        this.stop();
        this.audioBuffers = buffers;
        this.trackVolumes = buffers.map(() => 1.0); // Default volume 1.0
    }

    /**
     * Set Pitch (Key Shift)
     * @param semitones - Pitch shift in semitones (-12 to +12)
     */
    setPitch(semitones: number): void {
        this.pitch = semitones;
        this.processor.setPitchSemitones(semitones);
    }

    /**
     * Set Tempo (Playback Speed)
     * @param multiplier - 1.0 is normal, 0.5 is half speed, etc.
     */
    setTempo(multiplier: number): void {
        this.tempo = multiplier;
        this.processor.setTempo(multiplier);
    }

    /**
     * Set Reverb Level
     * @param level - 0.0 to 1.0
     */
    setReverbLevel(level: number): void {
        this.reverbGain.gain.value = Math.max(0, Math.min(1, level));
    }

    /**
     * Set Echo Level
     * @param level - 0.0 to 1.0
     */
    setEchoLevel(level: number): void {
        this.echoGain.gain.value = Math.max(0, Math.min(1, level));
    }

    /**
     * Set Master Gain
     * @param gain - Gain value in dB
     */
    setMasterGain(gain: number): void {
        this.masterGain.gain.value = gain;
    }

    /**
     * Set Bass Gain
     * @param gain - Gain value in dB
     */
    setBassGain(gain: number): void {
        this.bassNode.gain.value = gain;
    }

    /**
     * Set Mid Gain
     * @param gain - Gain value in dB
     */
    setMidGain(gain: number): void {
        this.midNode.gain.value = gain;
    }

    /**
     * Set Treble Gain
     * @param gain - Gain value in dB
     */
    setTrebleGain(gain: number): void {
        this.trebleNode.gain.value = gain;
    }

    /**
     * Set Voice Buffer (recorded audio)
     */
    setVoiceBuffer(buffer: AudioBuffer | null): void {
        this.voiceBuffer = buffer;
    }

    /**
     * Set Voice Volume
     */
    setVoiceVolume(volume: number): void {
        this.voiceVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Start playback
     */
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

            // Create ScriptProcessor
            this.scriptNode = this.audioContext.createScriptProcessor(BUFFER_SIZE, 2, 2);
            this.scriptNode.onaudioprocess = this.handleAudioProcess.bind(this);

            // Connect Master Graph
            // ScriptNode -> Destination (Dry)
            this.scriptNode.connect(this.audioContext.destination);

            // ScriptNode -> Effects
            this.scriptNode.connect(this.reverbNode);
            this.scriptNode.connect(this.echoNode);

            this.startTimeUpdateLoop();
            this.emit('play');
        }
    }

    /**
     * Pause playback
     */
    pause(): void {
        if (!this.isPlaying) return;

        this.disconnectScriptNode();
        this.isPlaying = false;
        this.isPaused = true;
        this.stopTimeUpdateLoop();
        this.emit('pause');
    }

    /**
     * Stop playback and reset
     */
    stop(): void {
        this.disconnectScriptNode();
        this.isPlaying = false;
        this.isPaused = false;
        this.playHead = 0;
        this.processor.reset();

        // Clear leftover buffers
        this.leftoverLeft = null;
        this.leftoverRight = null;
        this.leftoverIndex = 0;

        // Re-apply settings after reset
        this.processor.setPitchSemitones(this.pitch);
        this.processor.setTempo(this.tempo);

        this.stopTimeUpdateLoop();
        this.emit('stop');
    }

    private disconnectScriptNode() {
        if (this.scriptNode) {
            this.scriptNode.disconnect();
            this.scriptNode.onaudioprocess = null;
            this.scriptNode = null;
        }
    }

    /**
     * Audio Processing Loop
     */
    private handleAudioProcess(e: AudioProcessingEvent) {
        if (!this.isPlaying) return;

        const outputL = e.outputBuffer.getChannelData(0);
        const outputR = e.outputBuffer.getChannelData(1);

        // 1. Fetch RAW data from buffers
        const numSamplesNeeded = BUFFER_SIZE; // We assume 1:1 for input-fetching logic, SoundTouch handles time stretch buffering

        // Use an input buffer for SoundTouch
        // Ideally we fetch enough samples.
        // Logic: specific amount of INPUT samples produce BUFFER_SIZE OUTPUT samples? No.
        // Logic: We force feed SoundTouch, and it buffers.
        // We need to keep feeding it until it has enough data to output BUFFER_SIZE samples.
        // OR: We feed it chunk by chunk.

        // Better Strategy for ScriptProcessor:
        // We ask SoundTouch: "Give me BUFFER_SIZE samples".
        // It might return less if it needs more input.
        // So we loop:
        // While (SoundTouchOutput < BUFFER_SIZE) { Feed Input }

        const generatedL = new Float32Array(BUFFER_SIZE);
        const generatedR = new Float32Array(BUFFER_SIZE);
        let generatedCount = 0;

        // Safety Break
        let loopCount = 0;
        const maxLoops = 20;

        // First, consume any leftover samples from previous iteration
        if (this.leftoverLeft && this.leftoverRight && this.leftoverIndex < this.leftoverLeft.length) {
            const leftoverAvailable = this.leftoverLeft.length - this.leftoverIndex;
            const toCopy = Math.min(leftoverAvailable, BUFFER_SIZE);

            for (let k = 0; k < toCopy; k++) {
                generatedL[k] = this.leftoverLeft[this.leftoverIndex + k];
                generatedR[k] = this.leftoverRight[this.leftoverIndex + k];
            }
            generatedCount += toCopy;
            this.leftoverIndex += toCopy;

            // If we consumed all leftovers, clear them
            if (this.leftoverIndex >= this.leftoverLeft.length) {
                this.leftoverLeft = null;
                this.leftoverRight = null;
                this.leftoverIndex = 0;
            }
        }

        while (generatedCount < BUFFER_SIZE && loopCount < maxLoops) {
            loopCount++;

            // Try to extract from SoundTouch first (any leftovers?)
            // We can't "peek" easily.

            // Feed data
            const feedSize = BUFFER_SIZE; // Feed same amount as we want, usually good enough

            // Check if we hit end - FIX: Account for tempo in duration calculation
            // At slower tempos (< 1.0), the effective duration is longer (more output samples)
            // At faster tempos (> 1.0), the effective duration is shorter (fewer output samples)
            const effectiveDuration = this.getDuration() / this.tempo;
            if (this.playHead >= effectiveDuration * this.audioContext.sampleRate) {
                break;
            }

            const inputL = new Float32Array(feedSize);
            const inputR = new Float32Array(feedSize);

            // Mix tracks
            let activeTracks = 0;

            for (let i = 0; i < this.audioBuffers.length; i++) {
                const buffer = this.audioBuffers[i];
                const vol = this.trackVolumes[i];

                if (vol > 0 && buffer) {
                    const chL = buffer.getChannelData(0);
                    // Mono upmix or Stereo
                    const chR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : chL;

                    // Optimization: check bounds relative to this buffer
                    if (this.playHead < buffer.length) {
                        activeTracks++;
                        // Copy/Add
                        for (let s = 0; s < feedSize; s++) {
                            const idx = this.playHead + s;
                            if (idx < buffer.length) {
                                inputL[s] += chL[idx] * vol;
                                inputR[s] += chR[idx] * vol;
                            }
                        }
                    }
                }
            }

            // Mix Voice Track
            if (this.voiceBuffer && this.voiceVolume > 0) {
                const chL = this.voiceBuffer.getChannelData(0);
                const chR = this.voiceBuffer.numberOfChannels > 1 ? this.voiceBuffer.getChannelData(1) : chL;

                if (this.playHead < this.voiceBuffer.length) {
                    activeTracks++;
                    for (let s = 0; s < feedSize; s++) {
                        const idx = this.playHead + s;
                        if (idx < this.voiceBuffer.length) {
                            inputL[s] += chL[idx] * this.voiceVolume;
                            inputR[s] += chR[idx] * this.voiceVolume;
                        }
                    }
                }
            }

            // Advance Playhead - FIX: Account for tempo in playHead advancement
            // When tempo is slower (< 1.0), we consume input samples slower, so playHead should advance less
            // When tempo is faster (> 1.0), we consume input samples faster, so playHead should advance more
            // The playHead represents the INPUT sample position, so we divide by tempo
            this.playHead += Math.floor(feedSize / this.tempo);

            // If no tracks were active (silence/end), input is just zeros, still feed it to flush out tail

            // Process
            const processed = this.processor.process(inputL, inputR);

            if (processed) {
                // Append to generated
                const available = processed.left.length;
                const needed = BUFFER_SIZE - generatedCount;
                const toCopy = Math.min(available, needed);

                for (let k = 0; k < toCopy; k++) {
                    generatedL[generatedCount + k] = processed.left[k];
                    generatedR[generatedCount + k] = processed.right[k];
                }
                generatedCount += toCopy;

                // FIX: Buffer overflow handling - store excess samples for next iteration
                // If SoundTouch returned more samples than we needed, store the excess
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

            // Check if end - FIX: Account for tempo in end detection
            // At slower tempos, we need to continue processing even if no active tracks
            // because SoundTouch may still have buffered samples to output
            if (activeTracks === 0 && generatedCount < BUFFER_SIZE) {
                // End of playback - only stop if we have no leftovers and no active tracks
                if (!this.leftoverLeft && !this.leftoverRight) {
                    this.stop();
                    this.emit('ended');
                    break;
                }
            }
        }

        // Copy generated to output
        outputL.set(generatedL);
        outputR.set(generatedR);
    }

    /**
     * Set volume for a specific track
     */
    setVolume(volume: number, trackIndex?: number): void {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        if (trackIndex !== undefined) {
            this.trackVolumes[trackIndex] = clampedVolume;
        } else {
            this.trackVolumes = this.trackVolumes.map(() => clampedVolume);
        }
    }

    getVolume(trackIndex: number = 0): number {
        return this.trackVolumes[trackIndex] || 0;
    }

    // Stub for compatibility, but we don't expose GainNodes directly anymore as we mix manually
    getGainNodes(): GainNode[] {
        return [];
    }

    setCurrentTime(seconds: number): void {
        const duration = this.getDuration();
        const clampedTime = Math.max(0, Math.min(seconds, duration));

        this.playHead = Math.floor(clampedTime * this.audioContext.sampleRate);

        // Reset processor to clear buffers to avoid bleeding old audio
        this.processor.reset();
        this.processor.setPitchSemitones(this.pitch);
        this.processor.setTempo(this.tempo);

        this.emit('timeupdate', {
            currentTime: clampedTime,
            duration: duration
        });
    }

    getCurrentTime(): number {
        if (this.audioBuffers.length > 0) {
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

    on(event: EventType, callback: EventCallback): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    off(event: EventType, callback: EventCallback): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    private emit(event: EventType, data?: any): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }

    private startTimeUpdateLoop(): void {
        this.stopTimeUpdateLoop();
        this.updateInterval = window.setInterval(() => {
            this.emit('timeupdate', {
                currentTime: this.getCurrentTime(),
                duration: this.getDuration(),
            });
        }, 100);
    }

    private stopTimeUpdateLoop(): void {
        if (this.updateInterval !== null) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    dispose(): void {
        this.stop();
        this.listeners.clear();
        this.audioBuffers = [];
    }
}
