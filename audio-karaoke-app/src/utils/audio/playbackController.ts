/**
 * Playback Controller for Audio
 * Manages playback of AudioBuffers with event system and controls
 */

import { getAudioContext } from './audioContext';

type EventType = 'play' | 'pause' | 'stop' | 'timeupdate' | 'ended';
type EventCallback = (data?: any) => void;

export class PlaybackController {
    private audioContext: AudioContext;
    private reverbNode: ConvolverNode;
    private reverbGain: GainNode;
    private echoNode: DelayNode;
    private echoFeedback: GainNode;
    private echoGain: GainNode;

    private pitch: number = 0; // Detune in cents
    private tempo: number = 1.0; // Playback rate

    constructor() {
        this.audioContext = getAudioContext();

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

        // Graph Connections
        // Reverb: Input -> Gain -> Convolver -> Dest
        this.reverbNode.connect(this.reverbGain);
        this.reverbGain.connect(this.audioContext.destination);

        // Echo: Input -> Gain -> Delay -> Dest & Feedback
        this.echoNode.connect(this.echoGain);
        this.echoGain.connect(this.audioContext.destination);

        this.echoNode.connect(this.echoFeedback);
        this.echoFeedback.connect(this.echoNode);

        // Generate impulse response for reverb
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

        this.gainNodes = buffers.map(() => {
            const gainNode = this.audioContext.createGain();
            // Connect to Master Dry
            gainNode.connect(this.audioContext.destination);
            // Connect to Effects
            gainNode.connect(this.reverbNode);
            gainNode.connect(this.echoNode);
            return gainNode;
        });
    }

    /**
     * Set Pitch (Key Shift)
     * @param cents - Detune in cents (100 cents = 1 semitone)
     */
    setPitch(cents: number): void {
        this.pitch = cents;
        this.sources.forEach(source => {
            if (source.detune) {
                source.detune.value = cents;
            }
        });
    }

    /**
     * Set Tempo (Playback Speed)
     * @param multiplier - 1.0 is normal, 0.5 is half speed, etc.
     */
    setTempo(multiplier: number): void {
        this.tempo = multiplier;
        this.sources.forEach(source => {
            source.playbackRate.value = multiplier;
        });
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

        // Resume AudioContext if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // If paused, resume from pause position
        if (this.isPaused) {
            this.createAndStartSources(this.pauseTime);
            this.startTime = this.audioContext.currentTime - (this.pauseTime / this.tempo);
            this.isPaused = false;
        } else {
            // Start from beginning
            this.createAndStartSources(0);
            this.startTime = this.audioContext.currentTime;
            this.pauseTime = 0;
        }

        this.isPlaying = true;
        this.startTimeUpdateLoop();
        this.emit('play');
    }

    /**
     * Pause playback
     */
    pause(): void {
        if (!this.isPlaying) return;

        this.pauseTime = this.getCurrentTime();
        this.stopSources();
        this.isPlaying = false;
        this.isPaused = true;
        this.stopTimeUpdateLoop();
        this.emit('pause');
    }

    /**
     * Stop playback and reset
     */
    stop(): void {
        this.stopSources();
        this.isPlaying = false;
        this.isPaused = false;
        this.pauseTime = 0;
        this.startTime = 0;
        this.stopTimeUpdateLoop();
        this.emit('stop');
    }

    /**
     * Set volume for a specific track (or all tracks)
     * @param volume - Volume level (0-1)
     * @param trackIndex - Optional track index, if not provided sets all tracks
     */
    setVolume(volume: number, trackIndex?: number): void {
        const clampedVolume = Math.max(0, Math.min(1, volume));

        if (trackIndex !== undefined && this.gainNodes[trackIndex]) {
            this.gainNodes[trackIndex].gain.value = clampedVolume;
        } else {
            // Set volume for all tracks
            this.gainNodes.forEach(node => {
                node.gain.value = clampedVolume;
            });
        }
    }

    /**
     * Get volume for a specific track
     */
    getVolume(trackIndex: number = 0): number {
        return this.gainNodes[trackIndex]?.gain.value || 0;
    }

    /**
     * Get gain nodes for each track
     * Useful for connecting visualizers or other AudioNodes
     */
    getGainNodes(): GainNode[] {
        return this.gainNodes;
    }

    /**
     * Seek to specific time
     * @param seconds - Time position in seconds
     */
    setCurrentTime(seconds: number): void {
        const duration = this.getDuration();
        const clampedTime = Math.max(0, Math.min(seconds, duration));

        const wasPlaying = this.isPlaying;

        if (wasPlaying) {
            this.stopSources();
        }

        this.pauseTime = clampedTime;

        if (wasPlaying) {
            this.createAndStartSources(clampedTime);
            // When seeking, reset start time derived from seek pos and rate
            this.startTime = this.audioContext.currentTime - (clampedTime / this.tempo);
        } else {
            this.isPaused = true;
        }
    }

    /**
     * Get current playback time in seconds
     */
    getCurrentTime(): number {
        if (this.isPlaying) {
            // Account for tempo
            return (this.audioContext.currentTime - this.startTime) * this.tempo;
        }
        return this.pauseTime;
    }

    /**
     * Get duration of audio in seconds
     */
    getDuration(): number {
        return this.audioBuffers[0]?.duration || 0;
    }

    /**
     * Check if currently playing
     */
    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Add event listener
     */
    on(event: EventType, callback: EventCallback): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    /**
     * Remove event listener
     */
    off(event: EventType, callback: EventCallback): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to all listeners
     */
    private emit(event: EventType, data?: any): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }

    /**
     * Create and start source nodes
     * AudioBufferSourceNodes can only be played once, so we recreate them
     */
    private createAndStartSources(offset: number): void {
        this.sources = this.audioBuffers.map((buffer, index) => {
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            // Apply pitch and tempo
            source.detune.value = this.pitch;
            source.playbackRate.value = this.tempo;

            source.connect(this.gainNodes[index]);

            // Set up ended event for the first source only
            if (index === 0) {
                source.onended = () => {
                    if (this.isPlaying) {
                        this.stop();
                        this.emit('ended');
                    }
                };
            }

            source.start(0, offset);
            return source;
        });
    }

    /**
     * Stop all source nodes
     */
    private stopSources(): void {
        this.sources.forEach(source => {
            try {
                source.stop();
                source.disconnect();
            } catch (e) {
                // Source might already be stopped
            }
        });
        this.sources = [];
    }


    /**
     * Start time update loop
     */
    private startTimeUpdateLoop(): void {
        this.stopTimeUpdateLoop();
        this.updateInterval = window.setInterval(() => {
            this.emit('timeupdate', {
                currentTime: this.getCurrentTime(),
                duration: this.getDuration(),
            });
        }, 100); // Update every 100ms
    }

    /**
     * Stop time update loop
     */
    private stopTimeUpdateLoop(): void {
        if (this.updateInterval !== null) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        this.stop();
        this.listeners.clear();
        this.gainNodes.forEach(node => node.disconnect());
        this.gainNodes = [];
        this.audioBuffers = [];
    }
}
