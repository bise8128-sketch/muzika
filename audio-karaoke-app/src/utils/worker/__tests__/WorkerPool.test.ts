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
        jest.advanceTimersByTime(100);
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

    test('resolves on STREAM_READY response', async () => {
        class StreamReadyWorker extends MockWorker {
            constructor(script: string) {
                super(script);
                this.postMessage = jest.fn((message: any) => {
                    setTimeout(() => {
                        if (this.onmessage) {
                            this.onmessage({
                                data: {
                                    type: 'STREAM_READY',
                                    id: message.id,
                                    payload: { sessionId: 'session-123' }
                                }
                            } as MessageEvent);
                        }
                    }, 10);
                });
            }
        }

        // @ts-ignore
        global.Worker = StreamReadyWorker;

        pool = new WorkerPool({
            minWorkers: 1,
            maxWorkers: 1,
            workerScript: 'worker.js'
        });

        const p = pool.addTask('INIT_STREAM_SESSION', { modelInfo: {}, sessionId: 'session-123' });
        jest.runAllTimers();

        const result = await p;
        expect(result).toEqual({ sessionId: 'session-123' });
    });

    test('resolves on CHUNK_PROCESSED response with payload', async () => {
        const mockVocals = new Float32Array([1, 2, 3]);
        const mockInstrumentals = new Float32Array([4, 5, 6]);

        class ChunkProcessedWorker extends MockWorker {
            constructor(script: string) {
                super(script);
                this.postMessage = jest.fn((message: any) => {
                    setTimeout(() => {
                        if (this.onmessage) {
                            this.onmessage({
                                data: {
                                    type: 'CHUNK_PROCESSED',
                                    id: message.id,
                                    payload: {
                                        vocals: mockVocals,
                                        instrumentals: mockInstrumentals,
                                        chunkIndex: 0,
                                        sessionId: 'session-456'
                                    }
                                }
                            } as MessageEvent);
                        }
                    }, 10);
                });
            }
        }

        // @ts-ignore
        global.Worker = ChunkProcessedWorker;

        pool = new WorkerPool({
            minWorkers: 1,
            maxWorkers: 1,
            workerScript: 'worker.js'
        });

        const p = pool.addTask('PROCESS_STREAM_CHUNK', { chunk: new Float32Array(10), chunkIndex: 0 });
        jest.runAllTimers();

        const result: any = await p;
        expect(result.vocals).toEqual(mockVocals);
        expect(result.instrumentals).toEqual(mockInstrumentals);
        expect(result.chunkIndex).toBe(0);
    });

    test('resolves on COMPLETE response', async () => {
        class CompleteWorker extends MockWorker {
            constructor(script: string) {
                super(script);
                this.postMessage = jest.fn((message: any) => {
                    setTimeout(() => {
                        if (this.onmessage) {
                            this.onmessage({
                                data: {
                                    type: 'COMPLETE',
                                    id: message.id,
                                    payload: { fileHash: 'abc123', timestamp: 1000 }
                                }
                            } as MessageEvent);
                        }
                    }, 10);
                });
            }
        }

        // @ts-ignore
        global.Worker = CompleteWorker;

        pool = new WorkerPool({
            minWorkers: 1,
            maxWorkers: 1,
            workerScript: 'worker.js'
        });

        const p = pool.addTask('START_SEPARATION', {});
        jest.runAllTimers();

        const result: any = await p;
        expect(result.fileHash).toBe('abc123');
    });

    test('rejects on FAILED response', async () => {
        class FailedWorker extends MockWorker {
            constructor(script: string) {
                super(script);
                this.postMessage = jest.fn((message: any) => {
                    setTimeout(() => {
                        if (this.onmessage) {
                            this.onmessage({
                                data: {
                                    type: 'FAILED',
                                    id: message.id,
                                    payload: { message: 'Model loading failed' }
                                }
                            } as MessageEvent);
                        }
                    }, 10);
                });
            }
        }

        // @ts-ignore
        global.Worker = FailedWorker;

        pool = new WorkerPool({
            minWorkers: 1,
            maxWorkers: 1,
            workerScript: 'worker.js'
        });

        try {
            const p = pool.addTask('LOAD_MODEL', {});
            jest.runAllTimers();
            await p;
            throw new Error('Should have thrown');
        } catch (e: any) {
            expect(e.message).toBe('Model loading failed');
        }
    });

    test('PROGRESS messages do not resolve the task', async () => {
        class ProgressThenSuccessWorker extends MockWorker {
            constructor(script: string) {
                super(script);
                this.postMessage = jest.fn((message: any) => {
                    setTimeout(() => {
                        if (this.onmessage) {
                            // Send progress first
                            this.onmessage({
                                data: {
                                    type: 'PROGRESS',
                                    id: message.id,
                                    payload: 50
                                }
                            } as MessageEvent);
                        }
                    }, 5);
                    setTimeout(() => {
                        if (this.onmessage) {
                            // Then send success
                            this.onmessage({
                                data: {
                                    type: 'CHUNK_PROCESSED',
                                    id: message.id,
                                    payload: { chunkIndex: 0 }
                                }
                            } as MessageEvent);
                        }
                    }, 10);
                });
            }
        }

        // @ts-ignore
        global.Worker = ProgressThenSuccessWorker;

        const progressCallback = jest.fn();
        pool = new WorkerPool({
            minWorkers: 1,
            maxWorkers: 1,
            workerScript: 'worker.js'
        });

        const p = pool.addTask('PROCESS_CHUNK', {}, 'NORMAL', undefined, progressCallback);
        jest.runAllTimers();

        const result: any = await p;
        expect(progressCallback).toHaveBeenCalledWith(50);
        expect(result.chunkIndex).toBe(0);
    });

    test('lazy worker creation with minWorkers 0 (default)', () => {
        pool = new WorkerPool({
            maxWorkers: 4,
            workerScript: 'worker.js'
        });

        const stats = pool.getStats();
        expect(stats.totalWorkers).toBe(0);
        expect(stats.busyWorkers).toBe(0);
    });

    test('spawns worker on first task when minWorkers is 0', async () => {
        pool = new WorkerPool({
            maxWorkers: 2,
            workerScript: 'worker.js'
        });

        expect(pool.getStats().totalWorkers).toBe(0);

        const p = pool.addTask('TEST_TASK', { data: 'hello' });
        // Worker should have been created for this task
        expect(pool.getStats().totalWorkers).toBe(1);

        jest.runAllTimers();
        await p;
    });
});
