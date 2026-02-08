import { WorkerPool } from '../WorkerPool';
import { WorkerTask } from '../../../types/worker';

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
                    // Echo back the ID and simulate success
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

// Replace global Worker with MockWorker
global.Worker = MockWorker as any;

describe('WorkerPool', () => {
    let pool: WorkerPool;

    beforeEach(() => {
        jest.useFakeTimers();
        // Reset MockWorker specific mocks if needed, but since we instantiate new ones each time, it's fine.
        // However, we might want to spy on the constructor or instances.
    });

    afterEach(() => {
        if (pool) {
            pool.terminate();
        }
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

        // Fast-forward time for the setTimeout in MockWorker
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
        // Note: addTask is synchronous until the promise, but the worker creation might be sync.
        // MockWorker.postMessage uses setTimeout, so workers become busy immediately but don't finish yet.

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

        // Since maxWorkers is 1, it must reuse the same worker (or a new one replacing it, but logic should reuse)
        // We can't easily check identity without spying on internal map, but stats show count stays at 1
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
        const originalWorker = global.Worker;
        global.Worker = ErrorWorker as any;

        pool = new WorkerPool({
            minWorkers: 1,
            maxWorkers: 1,
            workerScript: 'worker.js'
        });

        try {
            const p = pool.addTask('FAIL_TASK', {});
            jest.runAllTimers();
            await p;
            fail('Should have thrown an error');
        } catch (e: any) {
            expect(e.message).toBe('Worker failed');
        }

        // Restore
        global.Worker = originalWorker;
    });
});
