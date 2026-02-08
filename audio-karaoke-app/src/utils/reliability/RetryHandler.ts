export interface RetryConfig {
    maxRetries: number;
    baseDelay: number; // in milliseconds
    maxDelay?: number;
    backoffFactor?: number;
    shouldRetry?: (error: unknown) => boolean;
}

export class RetryHandler {
    private readonly defaultRetries: number;
    private readonly defaultBaseDelay: number;

    constructor(defaultRetries: number = 3, defaultBaseDelay: number = 1000) {
        this.defaultRetries = defaultRetries;
        this.defaultBaseDelay = defaultBaseDelay;
    }

    public async execute<T>(
        fn: () => Promise<T>,
        config?: Partial<RetryConfig>
    ): Promise<T> {
        const maxRetries = config?.maxRetries ?? this.defaultRetries;
        const baseDelay = config?.baseDelay ?? this.defaultBaseDelay;
        const maxDelay = config?.maxDelay ?? 30000;
        const backoffFactor = config?.backoffFactor ?? 2;
        const shouldRetry = config?.shouldRetry ?? (() => true);

        let lastError: unknown;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                if (attempt === maxRetries || !shouldRetry(error)) {
                    throw error;
                }

                const delay = Math.min(
                    baseDelay * Math.pow(backoffFactor, attempt),
                    maxDelay
                );

                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }
}
