import { PitchShift, Player, context, start, ToneAudioBuffer, getContext } from 'tone';

type AudioEngineEvent = 'play' | 'pause' | 'stop' | 'timeupdate' | 'ended' | 'load';
type EventCallback = (data?: unknown) => void;

export class AudioEngine {
    private player: Player;
    private pitchShift: PitchShift;
    private listeners: Map<AudioEngineEvent, EventCallback[]> = new Map();
    private updateInterval: ReturnType<typeof setInterval> | null = null;

    // State
    private _isPlaying: boolean = false;
    private _duration: number = 0;
    private _currentTime: number = 0;

    // User settings
    private _pitch: number = 0; // Semitones
    private _tempo: number = 1.0; // Playback rate

    constructor() {
        // Initialize nodes
        this.pitchShift = new PitchShift({
            pitch: 0,
            windowSize: 0.1,
            delayTime: 0,
            feedback: 0
        }).toDestination();

        this.player = new Player().connect(this.pitchShift);

        // Setup internal events logic (Tone.Player doesn't emit 'timeupdate')
    }

    /**
     * Initialize audio context if needed (browser requires user gesture)
     */
    async initialize() {
        if (context.state !== 'running') {
            await start();
        }
    }

    /**
     * Load audio from ArrayBuffer
     */
    async load(buffer: ArrayBuffer) {
        // Decode buffer
        const audioBuffer = await context.decodeAudioData(buffer);
        this.player.buffer = new ToneAudioBuffer(audioBuffer);
        this._duration = audioBuffer.duration;
        this.emit('load', { duration: this._duration });
    }

    /**
     * Play audio
     */
    async play() {
        await this.initialize();

        if (this.player.state === 'started') return;

        // If we are at the end, restart
        if (this._currentTime >= this._duration) {
            this._currentTime = 0;
        }

        // Tone.Player.start(when, offset, duration)
        this.player.start(getContext().now(), this._currentTime);
        this._isPlaying = true;
        this.startUpdateInterval();
        this.emit('play');
    }

    /**
     * Pause audio
     */
    pause() {
        if (this.player.state !== 'started') return;

        this.player.stop();
        // Calculate where we stopped.
        // Tone.Player doesn't keep track of 'paused' time, it just stops.
        // We track _currentTime in the update loop, so we should be close.
        // However, for precision, we might need to rely on the last update.
        this._isPlaying = false;
        this.stopUpdateInterval();
        this.emit('pause');
    }

    /**
     * Stop audio
     */
    stop() {
        this.player.stop();
        this._isPlaying = false;
        this._currentTime = 0;
        this.stopUpdateInterval();
        this.emit('stop');
        this.emit('timeupdate', { currentTime: 0, duration: this._duration });
    }

    /**
     * Seek to time
     */
    seek(time: number) {
        const wasPlaying = this._isPlaying;

        if (wasPlaying) {
            this.player.stop();
        }

        this._currentTime = Math.max(0, Math.min(time, this._duration));

        if (wasPlaying) {
            this.player.start(getContext().now(), this._currentTime);
        }

        this.emit('timeupdate', { currentTime: this._currentTime, duration: this._duration });
    }

    /**
     * Set Pitch (Semitones)
     * To maintain tempo while changing pitch, we just use PitchShift.
     * To maintain pitch while changing tempo (playbackRate), we counter-shift.
     */
    setPitch(semitones: number) {
        this._pitch = semitones;
        this.updateProcessing();
    }

    /**
     * Set Tempo (Playback Rate)
     */
    setTempo(rate: number) {
        this._tempo = rate;
        this.updateProcessing();
    }

    /**
     * Apply combined Pitch and Tempo logic
     */
    private updateProcessing() {
        // 1. Set Playback Rate (Changes Speed AND Pitch)
        this.player.playbackRate = this._tempo;

        // 2. Calculate Pitch Shift needed
        // - Pitch change due to playback rate: 12 * log2(tempo)
        // - Desired Pitch change: this._pitch
        // - Net PitchShift needed = Desired - RateInduced

        const rateInducedPitchShift = 12 * Math.log2(this._tempo);
        const correction = this._pitch - rateInducedPitchShift;

        this.pitchShift.pitch = correction;
    }

    /**
     * Event Handling
     */
    on(event: AudioEngineEvent, callback: EventCallback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback);
    }

    /**
     * Remove Event Listener
     */
    off(event: AudioEngineEvent, callback: EventCallback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            this.listeners.set(event, callbacks.filter(cb => cb !== callback));
        }
    }

    private emit(event: AudioEngineEvent, data?: unknown) {
        this.listeners.get(event)?.forEach(cb => cb(data));
    }

    /**
     * Update Loop
     */
    private startUpdateInterval() {
        this.stopUpdateInterval();
        // Adjust for tempo?
        // Actually, Tone.Transport.seconds is easier if using Transport, but we are using pure time.
        // Better approach: track when we started and how much time elapsed * playbackRate.

        let lastTimestamp = Date.now();

        this.updateInterval = setInterval(() => {
            if (!this._isPlaying) return;

            const now = Date.now();
            const delta = (now - lastTimestamp) / 1000;
            lastTimestamp = now;

            // Advance current time by delta * tempo
            this._currentTime += delta * this._tempo;

            if (this._currentTime >= this._duration) {
                this.stop(); // Or handle loop
                this.emit('ended');
            } else {
                this.emit('timeupdate', { currentTime: this._currentTime, duration: this._duration });
            }
        }, 100); // 100ms update rate
    }

    private stopUpdateInterval() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Clean up
     */
    dispose() {
        this.stop();
        this.player.dispose();
        this.pitchShift.dispose();
    }
}
