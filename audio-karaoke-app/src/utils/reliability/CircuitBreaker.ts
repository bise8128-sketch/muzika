export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
}

export class CircuitOpenError extends Error {
    constructor(message: string = 'Circuit is open') {
        super(message);
        this.name = 'CircuitOpenError';
    }
}

export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number; // in milliseconds
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number | null = null;
    private readonly failureThreshold: number;
    private readonly resetTimeout: number;

    constructor(config: CircuitBreakerConfig) {
        this.failureThreshold = config.failureThreshold;
        this.resetTimeout = config.resetTimeout;
    }

    public async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.transitionTo(CircuitState.HALF_OPEN);
            } else {
                throw new CircuitOpenError();
            }
        }

        try {
            const result = await fn();
            if (this.state === CircuitState.HALF_OPEN) {
                this.reset();
            }
            return result;
        } catch (error) {
            // Don't trip the circuit breaker for AbortErrors (user cancellation)
            if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Aborted')) {
                throw error;
            }
            this.recordFailure();
            throw error;
        }
    }

    private recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.failureThreshold) {
            this.transitionTo(CircuitState.OPEN);
        }
    }

    private transitionTo(newState: CircuitState): void {
        this.state = newState;
        if (newState === CircuitState.OPEN) {
            // Keep failure count or reset? Usually keep track for metrics, but here state defines behavior
        } else if (newState === CircuitState.CLOSED) {
            this.reset();
        }
    }

    /**
     * Resets the circuit breaker to closed state.
     * Can be called externally for manual recovery.
     */
    public reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
    }

    public getState(): CircuitState {
        return this.state;
    }

    /**
     * Returns the current state as a string for logging/debugging.
     */
    public getStateString(): string {
        return this.state;
    }

    /**
     * Returns statistics about the circuit breaker.
     */
    public getStats(): { state: CircuitState; failureCount: number; lastFailureTime: number | null } {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime
        };
    }
}
