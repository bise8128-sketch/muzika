export interface ProgressState {
    processed: number;
    total: number;
    percent: number;
    speed: number; // items per second (or bytes per second)
    eta: number; // estimated seconds remaining
    elapsed: number; // seconds elapsed
}

/**
 * Utility class for tracking progress, calculating speed and ETA.
 */
export class ProgressTracker {
    private startTime: number = 0;
    private lastUpdateTime: number = 0;
    private processed: number = 0;
    private total: number = 0;

    // Smoothing factor for speed calculation (0 to 1). 
    // Higher values give more weight to recent speed.
    private readonly smoothingFactor: number = 0.1;
    private currentSpeed: number = 0;

    constructor(total: number = 0) {
        this.total = total;
    }

    start() {
        this.startTime = performance.now();
        this.lastUpdateTime = this.startTime;
        this.processed = 0;
        this.currentSpeed = 0;
    }
    update(processed: number) {
        const now = performance.now();
        const timeDelta = (now - this.lastUpdateTime) / 1000; // seconds

        // Only update speed if enough time has passed to get a stable reading (e.g., 100ms)
        // or if significant work has been done.
        // For now, let's just protect against zero division.
        if (timeDelta > 0.001) {
            const workDelta = processed - this.processed;
            const instantSpeed = workDelta / timeDelta;

            if (this.currentSpeed === 0) {
                this.currentSpeed = instantSpeed;
            } else {
                // Exponential moving average for smoother speed
                // Alpha = 0.1 means 10% weight to new sample, 90% to history
                // This makes it relatively stable but slow to react to changes
                this.currentSpeed = (instantSpeed * this.smoothingFactor) + (this.currentSpeed * (1 - this.smoothingFactor));
            }
            this.lastUpdateTime = now;
        }

        this.processed = processed;
    }

    get state(): ProgressState {
        const now = performance.now();
        const elapsed = (now - this.startTime) / 1000;

        const percent = this.total > 0 ? (this.processed / this.total) * 100 : 0;

        let eta = 0;
        if (this.currentSpeed > 0) {
            const remaining = this.total - this.processed;
            eta = remaining / this.currentSpeed;
        }

        return {
            processed: this.processed,
            total: this.total,
            percent: Math.min(100, Math.max(0, percent)),
            speed: this.currentSpeed,
            eta,
            elapsed
        };
    }
    setTotal(total: number) {
        this.total = total;
    }
}
