/**
 * Playback Controller for Audio
 * Manages playback of AudioBuffers with event system and controls
 */

import { getAudioContext } from './audioContext';

type EventType = 'play' | 'pause' | 'stop' | 'timeupdate' | 'ended';
type EventCallback = (data?: any) => void;

export class PlaybackController {
    private audioContext: AudioContext;
    private sources: AudioBufferSourceNode[] = [];
    private gainNodes: GainNode[] = [];
    private audioBuffers: AudioBuffer[] = [];

    private startTime: number = 0;
    private pauseTime: number = 0;
    private isPlaying: boolean = false;
    private isPaused: boolean = false;
    private updateInterval: number | null = null;

    private listeners: Map<EventType, EventCallback[]> = new Map();

    constructor() {
        this.audioContext = getAudioContext();
    }

    /**
     * Set audio buffers for playback (supports multiple tracks)
     * @param buffers - Array of AudioBuffers to play simultaneously
     */
    setAudioBuffers(buffers: AudioBuffer[]): void {
        this.stop();
        this.audioBuffers = buffers;

        // Create gain nodes for each buffer
        this.gainNodes = buffers.map(() => {
            const gainNode = this.audioContext.createGain();
            gainNode.connect(this.audioContext.destination);
            return gainNode;
        });
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
            this.startTime = this.audioContext.currentTime - this.pauseTime;
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
            this.startTime = this.audioContext.currentTime - clampedTime;
        } else {
            this.isPaused = true;
        }
    }

    /**
     * Get current playback time in seconds
     */
    getCurrentTime(): number {
        if (this.isPlaying) {
            return this.audioContext.currentTime - this.startTime;
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
