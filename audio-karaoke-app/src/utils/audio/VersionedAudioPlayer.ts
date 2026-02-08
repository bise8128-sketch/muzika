import {
    GrainPlayer,
    PitchShift,
    ToneAudioBuffer,
    Channel,
    EQ3,
    Reverb,
    FeedbackDelay,
    ToneAudioNode,
    Transport,
    now
} from 'tone/build/esm/index';

// Type definitions for state management
export interface TrackVersionState {
    id: string;
    name: string;
    pitch: number;      // Semitones
    tempo: number;      // Playback rate multiplier
    volume: number;     // Decibels or linear gain
    isMuted: boolean;
    isActive: boolean;  // Whether this is the currently audible version
}

export interface VersionCreationOptions {
    id: string;
    name: string;
    sourceId?: string; // ID of the version to clone from
}

/**
 * Represents a single version of an audio track with its own effects chain and playback settings.
 * Uses Tone.GrainPlayer for independent pitch and tempo manipulation.
 */
class AudioTrackVersion {
    public readonly id: string;
    public name: string;

    private player: GrainPlayer;
    private channel: Channel;
    private pitchShiftNode: PitchShift;
    private state: TrackVersionState;

    // Independent effects chain for this version
    private effectsChain: {
        eq: EQ3;
        reverb: Reverb;
        delay: FeedbackDelay;
    };

    constructor(
        id: string,
        name: string,
        buffer: ToneAudioBuffer,
        initialState?: Partial<TrackVersionState>
    ) {
        this.id = id;
        this.name = name;

        // Initialize State
        this.state = {
            id,
            name,
            pitch: 0,
            tempo: 1,
            volume: 0,
            isMuted: false,
            isActive: false,
            ...initialState
        };

        // Initialize Audio Nodes
        // Tone.GrainPlayer allows independent playbackRate (tempo) and detune (pitch)
        this.player = new GrainPlayer(buffer);

        // Granular settings for high fidelity
        this.player.grainSize = 0.2;
        this.player.overlap = 0.1;

        this.channel = new Channel({
            volume: this.state.volume,
            mute: this.state.isMuted
        });

        // Additional PitchShift node for extreme shifts or formant preservation if needed
        // Although GrainPlayer handles detune, sometimes a post-process shift is useful
        this.pitchShiftNode = new PitchShift({
            pitch: this.state.pitch
        });

        // Initialize Effects
        this.effectsChain = {
            eq: new EQ3(),
            reverb: new Reverb({ decay: 1.5, wet: 0 }),
            delay: new FeedbackDelay({ delayTime: 0.25, feedback: 0.2, wet: 0 })
        };

        // Routing: Player -> PitchShift -> EQ -> Delay -> Reverb -> Channel
        this.player.chain(
            this.pitchShiftNode,
            this.effectsChain.eq,
            this.effectsChain.delay,
            this.effectsChain.reverb,
            this.channel
        );

        // Apply initial state
        this.applyState();
    }

    /**
     * Connects this version to the main output or a destination node
     */
    connect(destination: ToneAudioNode) {
        this.channel.connect(destination);
    }

    /**
     * Syncs this version's playback position to a specific time
     */
    syncTo(time: number) {
        if (this.player.state === 'started') {
            // GrainPlayer doesn't support seek() directly in all versions, 
            // so we restart at the new offset
            this.player.stop();
            this.player.start(now(), time);
        } else {
            // If stopped, we just set the offset for next start
            // Note: Tone.js requires handling start/stop carefully
        }
    }

    /**
     * Starts playback at a specific time
     */
    start(time?: number, offset?: number, duration?: number) {
        if (this.player.state !== 'started') {
            this.player.start(time, offset, duration);
        }
    }

    /**
     * Stops playback
     */
    stop(time?: number) {
        this.player.stop(time);
    }

    /**
     * Updates the pitch (semitones)
     */
    setPitch(semitones: number) {
        this.state.pitch = semitones;
        // Option 1: Use GrainPlayer detune (100 cents = 1 semitone)
        this.player.detune = semitones * 100;

        // Option 2: Use PitchShift node (if GrainPlayer detune artifacts are undesirable)
        // this.pitchShiftNode.pitch = semitones;
    }

    /**
     * Updates the tempo (playback rate)
     */
    setTempo(rate: number) {
        this.state.tempo = rate;
        this.player.playbackRate = rate;
    }

    /**
     * Updates volume (db)
     */
    setVolume(db: number) {
        this.state.volume = db;
        this.channel.volume.rampTo(db, 0.1);
    }

    /**
     * Mutes/Unmutes
     */
    setMute(isMuted: boolean) {
        this.state.isMuted = isMuted;
        this.channel.mute = isMuted;
    }

    /**
     * Toggles active state (used for crossfading/solo)
     */
    setActive(isActive: boolean, rampTime: number = 0.1) {
        this.state.isActive = isActive;
        if (isActive) {
            // Unmute and fade in
            this.channel.mute = false;
            this.channel.volume.rampTo(this.state.volume, rampTime);
        } else {
            // Fade out then mute (optional, but safer to just fade out volume)
            this.channel.volume.rampTo(-60, rampTime); // -60dB is effectively silent
            // We can mute after ramp if we had a callback, but Tone.js scheduling is tricky here
            // keeping it simple.
        }
    }

    /**
     * Returns the current state
     */
    getState(): TrackVersionState {
        return { ...this.state };
    }

    /**
     * Disposes of all audio nodes
     */
    dispose() {
        this.player.dispose();
        this.pitchShiftNode.dispose();
        this.effectsChain.eq.dispose();
        this.effectsChain.reverb.dispose();
        this.effectsChain.delay.dispose();
        this.channel.dispose();
    }

    private applyState() {
        this.setPitch(this.state.pitch);
        this.setTempo(this.state.tempo);
        this.channel.volume.value = this.state.isActive ? this.state.volume : -60;
        this.channel.mute = this.state.isMuted;
    }

    // Getters for internal nodes if needed for visualization
    getOutputNode() {
        return this.channel;
    }
}

/**
 * Manager class to handle multiple versions of the same audio track.
 * Supports cloning, seamless toggling, and global transport control.
 */
export class VersionedAudioPlayer {
    private buffer: ToneAudioBuffer | null = null;
    private versions: Map<string, AudioTrackVersion> = new Map();
    private activeVersionId: string | null = null;
    private masterOutput: Channel;
    private isLoaded: boolean = false;
    private listeners: Set<() => void> = new Set();

    constructor() {
        this.masterOutput = new Channel().toDestination();
    }

    subscribe(callback: () => void) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private notify() {
        this.listeners.forEach(cb => cb());
    }

    /**
     * Loads the master audio buffer that all versions will share
     */
    async loadAudio(urlOrBuffer: string | AudioBuffer): Promise<void> {
        if (urlOrBuffer instanceof AudioBuffer) {
            this.buffer = new ToneAudioBuffer(urlOrBuffer);
        } else {
            this.buffer = await new ToneAudioBuffer().load(urlOrBuffer);
        }
        this.isLoaded = true;
    }

    /**
     * Creates a new version (clone) of the track
     */
    createVersion(options: VersionCreationOptions): TrackVersionState {
        if (!this.buffer) throw new Error("Audio buffer not loaded");

        let initialState: Partial<TrackVersionState> = {};

        // If cloning from existing source, inherit properties
        if (options.sourceId && this.versions.has(options.sourceId)) {
            const sourceVersion = this.versions.get(options.sourceId)!;
            const sourceState = sourceVersion.getState();
            initialState = {
                pitch: sourceState.pitch,
                tempo: sourceState.tempo,
                volume: sourceState.volume
            };
        }

        const version = new AudioTrackVersion(
            options.id,
            options.name,
            this.buffer,
            initialState
        );

        version.connect(this.masterOutput);
        this.versions.set(version.id, version);

        // If this is the first version, make it active
        if (this.versions.size === 1) {
            this.activateVersion(version.id);
        } else {
            // Sync the new version to the currently playing time if playing
            // but keep it inactive (silent)
            if (Transport.state === 'started') {
                version.syncTo(Transport.seconds);
                version.start(undefined, Transport.seconds); // Start but muted
            }
        }

        this.notify();
        return version.getState();
    }

    /**
     * Seamlessly switches the active playback to the target version
     */
    activateVersion(targetId: string, crossfadeDuration: number = 0.05) {
        if (!this.versions.has(targetId)) return;
        if (this.activeVersionId === targetId) return;

        const currentActive = this.activeVersionId ? this.versions.get(this.activeVersionId) : null;
        const nextActive = this.versions.get(targetId)!;

        // Strategy: Crossfade
        if (currentActive) {
            currentActive.setActive(false, crossfadeDuration);
        }

        nextActive.setActive(true, crossfadeDuration);
        this.activeVersionId = targetId;
        this.notify();
    }

    /**
     * Transport Controls
     */
    start() {
        const time = now();
        // Start all versions (even muted ones) to keep them in sync
        this.versions.forEach(v => v.start(time));
    }

    stop() {
        const time = now();
        this.versions.forEach(v => v.stop(time));
    }

    /**
     * Updates pitch for a specific version
     */
    setVersionPitch(id: string, semitones: number) {
        const version = this.versions.get(id);
        if (version) {
            version.setPitch(semitones);
            this.notify();
        }
    }

    /**
     * Updates tempo for a specific version
     */
    setVersionTempo(id: string, tempo: number) {
        const version = this.versions.get(id);
        if (version) {
            version.setTempo(tempo);
            this.notify();
        }
    }

    getVersionState(id: string): TrackVersionState | undefined {
        return this.versions.get(id)?.getState();
    }

    getAllVersions(): TrackVersionState[] {
        return Array.from(this.versions.values()).map(v => v.getState());
    }

    dispose() {
        this.versions.forEach(v => v.dispose());
        this.versions.clear();
        this.masterOutput.dispose();
        if (this.buffer) this.buffer.dispose();
    }
}
