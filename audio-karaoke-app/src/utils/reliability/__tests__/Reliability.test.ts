import { CircuitBreaker, CircuitState, CircuitOpenError } from '../CircuitBreaker';
import { RetryHandler } from '../RetryHandler';

describe('CircuitBreaker', () => {
    let breaker: CircuitBreaker;
    const config = {
        failureThreshold: 3,
        resetTimeout: 1000,
    };

    beforeEach(() => {
        breaker = new CircuitBreaker(config);
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should execute successfully when CLOSED', async () => {
        const fn = jest.fn().mockResolvedValue('success');
        const result = await breaker.execute(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
        expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition to OPEN after failure threshold reached', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        // First failure
        await expect(breaker.execute(fn)).rejects.toThrow('fail');
        expect(breaker.getState()).toBe(CircuitState.CLOSED);

        // Second failure
        await expect(breaker.execute(fn)).rejects.toThrow('fail');
        expect(breaker.getState()).toBe(CircuitState.CLOSED);

        // Third failure (threshold reached)
        await expect(breaker.execute(fn)).rejects.toThrow('fail');
        expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should fail fast when OPEN', async () => {
        // Manually force open state by failing 3 times
        const failFn = jest.fn().mockRejectedValue(new Error('fail'));
        for (let i = 0; i < 3; i++) {
            await expect(breaker.execute(failFn)).rejects.toThrow('fail');
        }

        expect(breaker.getState()).toBe(CircuitState.OPEN);

        const fn = jest.fn();
        await expect(breaker.execute(fn)).rejects.toThrow(CircuitOpenError);
        expect(fn).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
        // Open the circuit
        const failFn = jest.fn().mockRejectedValue(new Error('fail'));
        for (let i = 0; i < 3; i++) {
            await expect(breaker.execute(failFn)).rejects.toThrow('fail');
        }

        // Advance time past reset timeout
        jest.advanceTimersByTime(1100);

        // Next call should try to execute
        const successFn = jest.fn().mockResolvedValue('success');

        // This call triggers the state check, transitions to HALF_OPEN, then executes
        const result = await breaker.execute(successFn);

        expect(result).toBe('success');
        expect(successFn).toHaveBeenCalled();
        // After success, should be CLOSED
        expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen immediately on failure in HALF_OPEN', async () => {
        // Open the circuit
        const failFn = jest.fn().mockRejectedValue(new Error('fail'));
        for (let i = 0; i < 3; i++) {
            await expect(breaker.execute(failFn)).rejects.toThrow('fail');
        }

        // Advance time
        jest.advanceTimersByTime(1100);

        // Next call fails
        const nextFailFn = jest.fn().mockRejectedValue(new Error('fail again'));
        await expect(breaker.execute(nextFailFn)).rejects.toThrow('fail again');

        expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
});

describe('RetryHandler', () => {
    let retryHandler: RetryHandler;

    beforeEach(() => {
        retryHandler = new RetryHandler();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should return result immediately on success', async () => {
        const fn = jest.fn().mockResolvedValue('success');
        const result = await retryHandler.execute(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('fail 1'))
            .mockRejectedValueOnce(new Error('fail 2'))
            .mockResolvedValue('success');

        const promise = retryHandler.execute(fn, { baseDelay: 100, backoffFactor: 2 });

        // Fast-forward time for retries
        // 1st retry delay: 100 * 2^0 = 100
        // 2nd retry delay: 100 * 2^1 = 200

        // We need to advance timers because the retry logic waits
        // However, await retryHandler.execute blocks. We can't await it then advance timers.
        // We need to start it, then advance timers, then await result.

        // But since execute uses `await new Promise(...)` with setTimeout, 
        // we can advance timers inside if we run pending promises.
        // Jest's runAllTimers works well here.

        // Actually, awaiting the promise in `it` block with fake timers is tricky if we don't control the flow.
        // Easier way:

        let result;
        const execution = retryHandler.execute(fn, { baseDelay: 100 }).then(r => result = r);

        // Wait for first attempt (immediate)
        await Promise.resolve();
        // Advance for first retry delay
        jest.advanceTimersByTime(100);
        await Promise.resolve(); // allow microtasks to run

        // Advance for second retry delay
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        await execution;
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('fail'));
        const maxRetries = 2;

        const execution = retryHandler.execute(fn, { maxRetries, baseDelay: 100 });

        // 1st attempt (immediate)
        await Promise.resolve();
        // 1st retry delay
        jest.advanceTimersByTime(100);
        await Promise.resolve();
        // 2nd retry delay
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        await expect(execution).rejects.toThrow('fail');
        expect(fn).toHaveBeenCalledTimes(maxRetries + 1); // 1 initial + 2 retries
    });

    it('should not retry if shouldRetry returns false', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('fatal error'));
        const shouldRetry = jest.fn().mockReturnValue(false);

        await expect(retryHandler.execute(fn, { shouldRetry })).rejects.toThrow('fatal error');
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
