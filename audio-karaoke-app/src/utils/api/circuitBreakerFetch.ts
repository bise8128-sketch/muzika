import { CircuitBreaker, CircuitBreakerConfig } from '../reliability/CircuitBreaker';

// Default configuration for the global circuit breaker
const DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 3,
    resetTimeout: 10000, // 10 seconds
};

// Singleton instance for the backend service
// In a serverless environment (like Vercel functions), this instance might be recreated per request 
// if the container is cold-started, but will persist across hot invocations.
// For true distributed circuit breaking, we'd need a shared state (like Redis), 
// but this local instance helps with immediate retries in a single container.
const globalCircuitBreaker = new CircuitBreaker(DEFAULT_CONFIG);

/**
 * A wrapper around fetch that uses a CircuitBreaker to fail fast when the service is down.
 * @param url Request URL
 * @param options Fetch options
 * @param breaker Optional custom circuit breaker instance (defaults to global singleton)
 */
export async function circuitBreakerFetch(
    url: string | URL,
    options?: RequestInit,
    breaker: CircuitBreaker = globalCircuitBreaker
): Promise<Response> {
    return breaker.execute(async () => {
        const response = await fetch(url, options);

        // If the service returns a 5xx error, we might want to consider it a failure for the circuit breaker
        // fast-fail logic. However, CircuitBreaker usually tracks *exceptions* (network errors).
        // Let's treat 503 (Service Unavailable) and 504 (Gateway Timeout) as failures that trip the breaker.
        if (response.status === 503 || response.status === 504) {
            throw new Error(`Service Unavailable: ${response.status}`);
        }

        return response;
    });
}
