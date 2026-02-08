import { WorkerPool } from '../WorkerPool';
// We need to import types, but for test purposes we can use 'any' where types are complex
// import { WorkerTask } from '../../../types/worker';

// Mock Worker class
class MockWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    terminate: jest.Mock;
    postMessage: jest.Mock;

    constructor(scriptURL: string) {
        this.terminate = jest.fn();
        this.postMessage = jest.fn((message: any) => {
            // Simulate async processing
            setTimeout(() => {
                if (this.onmessage) {
                    // Echo back the ID and simulate success if not an error test
                    const response = {
                        type: 'SUCCESS',
                        id: message.id,
                        payload: { processed: true, original: message.payload }
                    };
                    this.onmessage({ data: response } as MessageEvent);
                }
            }, 10);
        });
    }
}

describe('WorkerPool', () => {
    let pool: WorkerPool;
    const originalWorker = global.Worker;

    beforeEach(() => {
        jest.useFakeTimers();
        // @ts-ignore
        global.Worker = MockWorker;
    });

    afterEach(() => {
        if (pool) {
            pool.terminate();
        }
        global.Worker = originalWorker;
        jest.useRealTimers();
    });

    test('initializes with minimum workers', () => {
        pool = new WorkerPool({
            minWorkers: 2,
            maxWorkers: 4,
            workerScript: 'worker.js',
            idleTimeout: 1000
        });

        const stats = pool.getStats();
        expect(stats.totalWorkers).toBe(2);
        expect(stats.busyWorkers).toBe(0);
        expect(stats.idleWorkers).toBe(2);
    });

    test('executes a task successfully', async () => {
        pool = new WorkerPool({
            minWorkers: 1,
            maxWorkers: 2,
            workerScript: 'worker.js'
        });

        const payload = { data: 'test' };
        const promise = pool.addTask('TEST_TASK', payload);

        // Fast-forward time
        jest.runAllTimers();

        const result = await promise;
        expect(result).toEqual({ processed: true, original: payload });
    });

    test('queues tasks when max workers reached', async () => {
        pool = new WorkerPool({
            minWorkers: 1,
            maxWorkers: 2,
            workerScript: 'worker.js'
        });

        // Add 3 tasks
        const p1 = pool.addTask('TASK_1', {});
        const p2 = pool.addTask('TASK_2', {});
        const p3 = pool.addTask('TASK_3', {});

        let stats = pool.getStats();
        // Should have 2 workers busy, 1 task in queue
        expect(stats.totalWorkers).toBe(2);
        expect(stats.busyWorkers).toBe(2);
        expect(stats.queueLength).toBe(1);

        // Resolve all
        jest.runAllTimers();

        await Promise.all([p1, p2, p3]);

        stats = pool.getStats();
        expect(stats.busyWorkers).toBe(0);
        expect(stats.queueLength).toBe(0);
    });

    test('reuses workers', async () => {
        pool = new WorkerPool({
            minWorkers: 1,
            maxWorkers: 1,
            workerScript: 'worker.js'
        });

        const p1 = pool.addTask('TASK_1', {});
        jest.runAllTimers();
        await p1;

        const p2 = pool.addTask('TASK_2', {});
        jest.runAllTimers();
        await p2;

        const stats = pool.getStats();
        expect(stats.totalWorkers).toBe(1);
    });

    test('terminates idle workers after timeout', async () => {
        pool = new WorkerPool({
            minWorkers: 0,
            maxWorkers: 2,
            workerScript: 'worker.js',
            idleTimeout: 1000
        });

        // Run a task to spawn a worker
        const p1 = pool.addTask('TASK_1', {});
        jest.runAllTimers();
        await p1;

        // Worker should be idle now
        let stats = pool.getStats();
        expect(stats.totalWorkers).toBe(1);
        expect(stats.idleWorkers).toBe(1);

        // Advance time past idle timeout
        jest.advanceTimersByTime(1500);

        stats = pool.getStats();
        expect(stats.totalWorkers).toBe(0);
    });

    test('handles worker errors', async () => {
        // Setup a worker that fails
        class ErrorWorker extends MockWorker {
            constructor(script: string) {
                super(script);
                this.postMessage = jest.fn((message: any) => {
                    setTimeout(() => {
                        if (this.onmessage) {
                            this.onmessage({
                                data: {
                                    type: 'ERROR',
                                    id: message.id,
                                    payload: { message: 'Worker failed' }
                                }
                            } as MessageEvent);
                        }
                    }, 10);
                });
            }
        }

        // Override global worker for this test
        // @ts-ignore
        global.Worker = ErrorWorker;

        pool = new WorkerPool({
            minWorkers: 1,
            maxWorkers: 1,
            workerScript: 'worker.js'
        });

        try {
            const p = pool.addTask('FAIL_TASK', {});
            jest.runAllTimers();
            await p;
            throw new Error('Should have thrown an error');
        } catch (e: any) {
            expect(e.message).toBe('Worker failed');
        }
    });
});
