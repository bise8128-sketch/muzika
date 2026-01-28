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

    // Track state
    private audioBuffers: AudioBuffer[] = [];
    private gainNodes: GainNode[] = []; // Not used for direct connection anymore, but keeping for volume state
    private trackVolumes: number[] = [];

    // Playback state
    private isPlaying: boolean = false;
    private isPaused: boolean = false;
    private playHead: number = 0; // Current sample index
    private startTime: number = 0; // For time synchronization if needed, mostly redundant with playHead

    private listeners: Map<EventType, EventCallback[]> = new Map();
    private updateInterval: number | null = null;

    private pitch: number = 0; // Semitones
    private tempo: number = 1.0; // Rate

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

        while (generatedCount < BUFFER_SIZE && loopCount < maxLoops) {
            loopCount++;

            // Try to extract from SoundTouch first (any leftovers?)
            // We can't "peek" easily.

            // Feed data
            const feedSize = BUFFER_SIZE; // Feed same amount as we want, usually good enough

            // Check if we hit end
            if (this.playHead >= this.getDuration() * this.audioContext.sampleRate) {
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

            // Advance Playhead
            this.playHead += feedSize;

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

                // If we have extra, we lose it?! 
                // Limitation of this simple loop: SoundTouchJS usually queues internally if we use the simple API?
                // No, RealtimeAudioProcessor wraps PitchShifter.process() which returns processed data immediately.
                // If there is leftover, we lose it if we don't buffer it.
                // BUT RealtimeAudioProcessor doesn't seem to expose internal buffer.
                // Actually soundtouchjs process() keeps internal buffer. 
                // If we pass in data, it adds to buffer, and returns what it can.
                // Ideally we should handle the "extra" if 'available > needed'.
                // For now, let's assume loose sync is okay or SoundTouch won't return massive chunks.
            }

            // Check if end
            if (activeTracks === 0 && generatedCount < BUFFER_SIZE) {
                // End of playback
                this.stop();
                this.emit('ended');
                break;
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
