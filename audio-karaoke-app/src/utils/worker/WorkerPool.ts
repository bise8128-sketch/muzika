import { WorkerTask, WorkerPoolConfig, TaskPriority } from '../../types/worker';

export interface AcquiredWorker {
    id: string;
    send<TResult>(
        type: string,
        payload: unknown,
        transferables?: Transferable[],
        onProgress?: (p: number) => void
    ): Promise<TResult>;
    release(): void;
    terminate(): void;
}

/**
 * Wrapper around a standard Web Worker to manage its state and task execution.
 */
class WorkerWrapper {
    private worker: Worker;
    private currentTask: WorkerTask | null = null;
    private readonly factoryOrScript: string | URL | (() => Worker);
    private readonly onTaskComplete: (wrapper: WorkerWrapper) => void;
    private readonly onError: (wrapper: WorkerWrapper, error: Error, failedTask?: WorkerTask | null, failedQueue?: WorkerTask[]) => void;

    // For stateful session routing
    private taskQueue: WorkerTask[] = [];
    private inFlight = false;
    private watchdogId: ReturnType<typeof setTimeout> | null = null;

    public id: string;
    public isBusy: boolean = false;
    public isAcquired: boolean = false; // If true, pool shouldn't assign random tasks to it

    constructor(
        id: string,
        factoryOrScript: string | URL | (() => Worker),
        onTaskComplete: (wrapper: WorkerWrapper) => void,
        onError: (wrapper: WorkerWrapper, error: Error) => void
    ) {
        this.id = id;
        this.factoryOrScript = factoryOrScript;
        this.onTaskComplete = onTaskComplete;
        this.onError = onError;
        this.worker = this.initializeWorker();
    }

    private initializeWorker(): Worker {
        let worker: Worker;
        if (typeof this.factoryOrScript === 'function') {
            worker = this.factoryOrScript();
        } else {
            worker = new Worker(this.factoryOrScript, { type: 'module' });
        }

        worker.onmessage = (event: MessageEvent) => {
            this.handleMessage(event);
        };

        worker.onerror = (error: ErrorEvent | Event) => {
            let message = 'Worker error occurred';
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const errAny = error as any;
            
            if ('message' in error) {
                message = `Worker error: ${error.message} at ${error.filename}:${error.lineno}:${error.colno}`;
                console.error(`[WorkerWrapper ${this.id}] Error Message:`, error.message);
            } else if (errAny.message) {
                message = `Worker error: ${errAny.message}`;
                console.error(`[WorkerWrapper ${this.id}] Error (from property):`, message);
            } else {
                console.error(`[WorkerWrapper ${this.id}] Generic Error Event:`, error);
                if (errAny.type === 'error' && !errAny.message) {
                    message = `Worker script failed to load or had a syntax error. Source: ${this.factoryOrScript}`;
                }
            }
            this.handleError(new Error(message));
        };

        return worker;
    }

    private resetWatchdog(): void {
        if (this.watchdogId) clearTimeout(this.watchdogId);
        this.watchdogId = setTimeout(() => {
            if (this.inFlight) {
                console.warn(`[WorkerWrapper ${this.id}] Watchdog timeout`);
                this.handleError(new Error('Worker timeout: no response for 60 seconds'));
            }
        }, 60000);
    }

    private clearWatchdog(): void {
        if (this.watchdogId) {
            clearTimeout(this.watchdogId);
            this.watchdogId = null;
        }
    }

    public execute(task: WorkerTask): void {
        if (!this.isAcquired && this.isBusy && !this.inFlight) {
            // Should not happen, but safeguard
            throw new Error(`Worker ${this.id} is already busy`);
        }

        this.isBusy = true;
        
        if (this.inFlight) {
            this.taskQueue.push(task);
        } else {
            this.dispatch(task);
        }
    }

    private dispatch(task: WorkerTask): void {
        this.inFlight = true;
        this.currentTask = task;
        this.resetWatchdog();

        try {
            this.worker.postMessage({
                type: task.type,
                payload: task.payload,
                id: task.id // Sending ID so updated worker can return it
            }, task.transferables || []);
        } catch (error) {
            this.handleError(error instanceof Error ? error : new Error('Failed to post message to worker'));
        }
    }

    private flushQueue(): void {
        if (this.taskQueue.length > 0) {
            this.dispatch(this.taskQueue.shift()!);
        } else {
            this.inFlight = false;
            this.currentTask = null;
            if (!this.isAcquired) {
                this.isBusy = false;
                this.onTaskComplete(this);
            }
        }
    }

    private handleMessage(event: MessageEvent): void {
        if (!this.currentTask) return;

        const { type, payload, id } = event.data;

        // Validation: Ensure response matches current task
        if (id && id !== this.currentTask.id) {
            console.warn(`Worker ${this.id} received message for unknown task ID: ${id}`);
            return;
        }

        if (type === 'ERROR' || type === 'FAILED') {
            this.clearWatchdog();
            this.currentTask.reject(new Error(payload?.message || 'Unknown worker error'));
            this.flushQueue();
        } else if (type === 'PROGRESS') {
            this.resetWatchdog();
            if (this.currentTask.onProgress) {
                const progressValue = typeof payload === 'number'
                    ? payload
                    : (payload?.percentage ?? payload?.progress);
                if (typeof progressValue === 'number') {
                    this.currentTask.onProgress(progressValue);
                }
            }
        } else {
            this.clearWatchdog();
            this.currentTask.resolve(payload);
            this.flushQueue();
        }
    }

    private handleError(error: Error): void {
        console.error(`Worker ${this.id} error:`, error);
        this.clearWatchdog();

        if (this.currentTask) {
            this.currentTask.reject(error);
        }
        
        // Reject all queued tasks
        while (this.taskQueue.length > 0) {
            this.taskQueue.shift()?.reject(error);
        }

        this.inFlight = false;
        this.currentTask = null;
        
        if (!this.isAcquired) {
            this.isBusy = false;
            this.onTaskComplete(this);
        }

        this.onError(this, error);
    }

    public terminate(): void {
        this.clearWatchdog();
        this.worker.terminate();
        if (this.currentTask) {
            this.currentTask.reject(new Error('Worker terminated'));
        }
        while (this.taskQueue.length > 0) {
            this.taskQueue.shift()?.reject(new Error('Worker terminated'));
        }
    }
}

/**
 * Manages a pool of Web Workers to execute tasks concurrently with limits.
 */
export class WorkerPool {
    private workers: Map<string, WorkerWrapper> = new Map();
    private taskQueue: WorkerTask[] = [];
    private acquisitionQueue: Array<{ resolve: (worker: AcquiredWorker) => void; reject: (err: Error) => void }> = [];
    private readonly maxWorkers: number;
    private readonly minWorkers: number;
    private readonly idleTimeout: number;
    private readonly scriptPath?: string | URL;
    private readonly workerFactory?: () => Worker;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private isDestroyed = false;

    constructor(config: WorkerPoolConfig) {
        if (!config.workerScript && !config.workerFactory) {
            throw new Error('WorkerPool requires either workerScript or workerFactory');
        }
        this.scriptPath = config.workerScript;
        this.workerFactory = config.workerFactory;
        this.maxWorkers = config.maxWorkers ?? (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4);
        this.minWorkers = config.minWorkers ?? 0;
        this.idleTimeout = config.idleTimeout ?? 30000;

        if (this.minWorkers > 0) {
            this.ensureMinWorkers();
        }
    }

    private ensureMinWorkers(): void {
        const currentCount = this.workers.size;
        const min = this.minWorkers;
        if (currentCount < min) {
            for (let i = currentCount; i < min; i++) {
                this.createWorker();
            }
        }
    }

    private createWorker(): WorkerWrapper {
        const id = crypto.randomUUID();
        const source = this.workerFactory || this.scriptPath!;
        
        const wrapper = new WorkerWrapper(
            id,
            source,
            (w) => this.onWorkerTaskComplete(w),
            (w, err) => this.onWorkerError(w, err)
        );
        this.workers.set(id, wrapper);
        return wrapper;
    }

    private getIdleWorker(): WorkerWrapper | undefined {
        for (const worker of this.workers.values()) {
            if (!worker.isBusy && !worker.isAcquired) {
                return worker;
            }
        }
        return undefined;
    }

    public async acquire(): Promise<AcquiredWorker> {
        if (this.isDestroyed) {
            throw new Error('WorkerPool is destroyed');
        }

        return new Promise<AcquiredWorker>((resolve, reject) => {
            let worker = this.getIdleWorker();

            if (!worker && this.workers.size < this.maxWorkers) {
                worker = this.createWorker();
            }

            if (worker) {
                this.startIdleTimer();
                this.grantWorker(worker, resolve);
            } else {
                // Queue the acquisition request
                this.acquisitionQueue.push({ resolve, reject });
            }
        });
    }

    private grantWorker(worker: WorkerWrapper, resolve: (w: AcquiredWorker) => void) {
        worker.isAcquired = true;
        worker.isBusy = true;
        
        resolve({
            id: worker.id,
            send: <TResult>(
                type: string,
                payload: unknown,
                transferables?: Transferable[],
                onProgress?: (p: number) => void
            ): Promise<TResult> => {
                return new Promise<TResult>((res, rej) => {
                    const task: WorkerTask<unknown, TResult> = {
                        id: crypto.randomUUID(),
                        type,
                        priority: 'NORMAL',
                        payload,
                        transferables,
                        onProgress,
                        resolve: res,
                        reject: rej
                    };
                    worker.execute(task);
                });
            },
            release: () => {
                worker.isAcquired = false;
                worker.isBusy = false;
                this.onWorkerTaskComplete(worker);
            },
            terminate: () => {
                worker.terminate();
                this.workers.delete(worker.id);
                this.processQueue();
                this.ensureMinWorkers();
            }
        });
    }

    public addTask<TPayload, TResult>(
        type: string,
        payload: TPayload,
        priority: TaskPriority = 'NORMAL',
        transferables?: Transferable[],
        onProgress?: (progress: number) => void
    ): Promise<TResult> {
        if (this.isDestroyed) {
            return Promise.reject(new Error('WorkerPool is destroyed'));
        }

        return new Promise<TResult>((resolve, reject) => {
            const task: WorkerTask<TPayload, TResult> = {
                id: crypto.randomUUID(),
                type,
                priority,
                payload,
                transferables,
                onProgress,
                resolve,
                reject
            };

            this.enqueueTask(task);
            this.processQueue();
        });
    }

    private enqueueTask(task: WorkerTask): void {
        this.taskQueue.push(task);
        this.sortQueue();
    }

    private sortQueue(): void {
        const priorityValue = { 'HIGH': 3, 'NORMAL': 2, 'LOW': 1 };
        this.taskQueue.sort((a, b) => priorityValue[b.priority] - priorityValue[a.priority]);
    }

    private processQueue(): void {
        if (this.acquisitionQueue.length > 0) {
            let worker = this.getIdleWorker();
            if (!worker && this.workers.size < this.maxWorkers) {
                worker = this.createWorker();
            }
            if (worker) {
                this.startIdleTimer();
                const deferred = this.acquisitionQueue.shift();
                if (deferred) {
                    this.grantWorker(worker, deferred.resolve);
                    // Process next in queue if possible
                    this.processQueue();
                    return;
                }
            }
        }

        if (this.taskQueue.length === 0) return;

        let worker = this.getIdleWorker();

        if (!worker && this.workers.size < this.maxWorkers) {
            worker = this.createWorker();
        }

        if (worker) {
            const task = this.taskQueue.shift();
            if (task) {
                this.startIdleTimer();
                worker.execute(task);
                // Process next in queue if possible
                this.processQueue();
            }
        }
    }

    private onWorkerTaskComplete(worker: WorkerWrapper): void {
        if (worker.isAcquired) return;
        
        if (this.acquisitionQueue.length > 0 || this.taskQueue.length > 0) {
            this.processQueue();
        } else {
            this.startIdleTimer();
        }
    }

    private onWorkerError(worker: WorkerWrapper, error: Error): void {
        console.error(`WorkerPool received error from worker ${worker.id}:`, error);
        worker.terminate();
        this.workers.delete(worker.id);

        this.processQueue();
        this.ensureMinWorkers();
    }

    private startIdleTimer(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }

        this.idleTimer = setTimeout(() => {
            this.pruneIdleWorkers();
        }, this.idleTimeout || 30000);
    }

    private pruneIdleWorkers(): void {
        const min = this.minWorkers ?? 0;
        if (this.workers.size <= min) return;

        const toRemove: string[] = [];

        for (const [id, worker] of this.workers.entries()) {
            if (!worker.isBusy && !worker.isAcquired && this.workers.size - toRemove.length > min) {
                worker.terminate();
                toRemove.push(id);
            }
        }

        toRemove.forEach(id => this.workers.delete(id));
    }

    public terminate(): void {
        this.isDestroyed = true;
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        for (const worker of this.workers.values()) {
            worker.terminate();
        }
        this.workers.clear();
        this.taskQueue = [];
        this.acquisitionQueue.forEach(deferred => deferred.reject(new Error('WorkerPool terminated')));
        this.acquisitionQueue = [];
    }

    public getStats() {
        return {
            totalWorkers: this.workers.size,
            busyWorkers: Array.from(this.workers.values()).filter(w => w.isBusy || w.isAcquired).length,
            idleWorkers: Array.from(this.workers.values()).filter(w => !w.isBusy && !w.isAcquired).length,
            queueLength: this.taskQueue.length,
            acquisitionQueueLength: this.acquisitionQueue.length
        };
    }
}
