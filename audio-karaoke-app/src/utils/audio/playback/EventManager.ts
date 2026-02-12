/**
 * EventManager — Typed event emitter for playback events.
 * Extracted from PlaybackController to isolate the pub/sub concern.
 */

export type EventType = 'play' | 'pause' | 'stop' | 'timeupdate' | 'ended' | 'seeked';
export type EventCallback = (data?: unknown) => void;

export class EventManager {
    private listeners: Map<EventType, EventCallback[]> = new Map();
    private updateInterval: number | null = null;

    /** Provide a time-source callback; called every 100ms while the loop is active. */
    private timeSource: (() => { currentTime: number; duration: number }) | null = null;

    /** Attach a function that returns current playback time & duration. */
    setTimeSource(fn: () => { currentTime: number; duration: number }): void {
        this.timeSource = fn;
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

    emit(event: EventType, data?: unknown): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }

    startTimeUpdateLoop(): void {
        this.stopTimeUpdateLoop();
        this.updateInterval = window.setInterval(() => {
            if (this.timeSource) {
                this.emit('timeupdate', this.timeSource());
            }
        }, 100);
    }

    stopTimeUpdateLoop(): void {
        if (this.updateInterval !== null) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    dispose(): void {
        this.stopTimeUpdateLoop();
        this.listeners.clear();
    }
}
