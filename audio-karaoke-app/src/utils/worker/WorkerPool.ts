import { WorkerTask, WorkerPoolConfig, TaskPriority } from '../../types/worker';

/**
 * Wrapper around a standard Web Worker to manage its state and task execution.
 */
class WorkerWrapper {
    private worker: Worker;
    private currentTask: WorkerTask | null = null;
    private readonly scriptPath: string | URL;
    private readonly onTaskComplete: (wrapper: WorkerWrapper) => void;
    private readonly onError: (wrapper: WorkerWrapper, error: Error) => void;

    public id: string;
    public isBusy: boolean = false;

    constructor(
        id: string,
        scriptPath: string | URL,
        onTaskComplete: (wrapper: WorkerWrapper) => void,
        onError: (wrapper: WorkerWrapper, error: Error) => void
    ) {
        this.id = id;
        this.scriptPath = scriptPath;
        this.onTaskComplete = onTaskComplete;
        this.onError = onError;
        this.worker = this.initializeWorker();
    }

    private initializeWorker(): Worker {
        const worker = new Worker(this.scriptPath, { type: 'module' });

        worker.onmessage = (event: MessageEvent) => {
            this.handleMessage(event);
        };

        worker.onerror = (error: ErrorEvent | Event) => {
            const message = (error as ErrorEvent).message || 'Worker error occurred';
            this.handleError(new Error(message));
        };

        return worker;
    }

    public execute(task: WorkerTask): void {
        if (this.isBusy) {
            throw new Error(`Worker ${this.id} is already busy`);
        }

        this.isBusy = true;
        this.currentTask = task;

        try {
            // Wrap the payload with the task ID for correlation if the worker supports it
            // For now, we assume the worker accepts the raw payload structure defined in the task
            // but we might need to send { type, payload, id }
            this.worker.postMessage({
                type: task.type,
                payload: task.payload,
                id: task.id // Sending ID so updated worker can return it
            }, task.transferables || []);
        } catch (error) {
            this.handleError(error instanceof Error ? error : new Error('Failed to post message to worker'));
        }
    }

    private handleMessage(event: MessageEvent): void {
        if (!this.currentTask) return;

        const { type, payload, id, progress } = event.data;

        // Validation: Ensure response matches current task
        // If the worker supports IDs, we check. If not, we assume it's for the current task.
        if (id && id !== this.currentTask.id) {
            console.warn(`Worker ${this.id} received message for unknown task ID: ${id}`);
            return;
        }

        switch (type) {
            case 'SUCCESS':
            case 'COMPLETED':
            case 'DONE': // Allow flexibility in success signals
                this.currentTask.resolve(payload);
                this.completeTask();
                break;

            case 'ERROR':
            case 'FAILED':
                this.currentTask.reject(new Error(payload?.message || 'Unknown worker error'));
                this.completeTask();
                break;

            case 'PROGRESS':
                if (this.currentTask.onProgress && typeof progress === 'number') {
                    this.currentTask.onProgress(progress);
                }
                break;

            default:
                // Handle other message types if necessary, or treat as success if implicit
                // For now, we strictly require explicit success/error/progress
                break;
        }
    }

    private handleError(error: Error): void {
        console.error(`Worker ${this.id} error:`, error);

        if (this.currentTask) {
            this.currentTask.reject(error);
        }

        // If the worker crashes, we might need to recreate it
        this.completeTask(); // Mark as free so pool can handle it (or terminate it)

        // Notify pool of error (which might decide to terminate this wrapper)
        this.onError(this, error);
    }

    private completeTask(): void {
        this.isBusy = false;
        this.currentTask = null;
        this.onTaskComplete(this);
    }

    public terminate(): void {
        this.worker.terminate();
    }
}

/**
 * Manages a pool of Web Workers to execute tasks concurrently with limits.
 */
export class WorkerPool {
    private config: WorkerPoolConfig;
    private workers: Map<string, WorkerWrapper> = new Map();
    private taskQueue: WorkerTask[] = [];
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private isDestroyed = false;

    constructor(config: WorkerPoolConfig) {
        this.config = {
            minWorkers: 1,
            maxWorkers: navigator.hardwareConcurrency || 4,
            idleTimeout: 30000,
            ...config
        };

        // Initialize minimum workers
        // We do this lazily or immediately? 
        // Plan says "Configuration: minWorkers", so let's respect it.
        this.ensureMinWorkers();
    }

    private ensureMinWorkers(): void {
        const currentCount = this.workers.size;
        if (currentCount < (this.config.minWorkers || 1)) {
            for (let i = currentCount; i < (this.config.minWorkers || 1); i++) {
                this.createWorker();
            }
        }
    }

    private createWorker(): WorkerWrapper {
        const id = crypto.randomUUID();
        const worker = new WorkerWrapper(
            id,
            this.config.workerScript,
            (w) => this.onWorkerTaskComplete(w),
            (w, err) => this.onWorkerError(w, err)
        );
        this.workers.set(id, worker);
        return worker;
    }

    private getIdleWorker(): WorkerWrapper | undefined {
        for (const worker of this.workers.values()) {
            if (!worker.isBusy) {
                return worker;
            }
        }
        return undefined;
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
        // Simple priority handling: HIGH > NORMAL > LOW
        // We could use a proper priority queue data structure, but array sort is fine for small queues
        this.taskQueue.push(task);
        this.sortQueue();
    }

    private sortQueue(): void {
        const priorityValue = { 'HIGH': 3, 'NORMAL': 2, 'LOW': 1 };
        this.taskQueue.sort((a, b) => priorityValue[b.priority] - priorityValue[a.priority]);
    }

    private processQueue(): void {
        if (this.taskQueue.length === 0) return;

        // Try to get an idle worker
        let worker = this.getIdleWorker();

        // If no idle worker, check if we can spawn a new one
        if (!worker && this.workers.size < (this.config.maxWorkers || 4)) {
            worker = this.createWorker();
        }

        if (worker) {
            const task = this.taskQueue.shift();
            if (task) {
                this.startIdleTimer(); // Reset timer
                worker.execute(task);
            }
        }
    }

    private onWorkerTaskComplete(worker: WorkerWrapper): void {
        // Worker is now free. Check if there are more tasks.
        if (this.taskQueue.length > 0) {
            this.processQueue();
        } else {
            this.startIdleTimer();
        }
    }

    private onWorkerError(worker: WorkerWrapper, error: Error): void {
        console.error(`WorkerPool received error from worker ${worker.id}:`, error);
        // If the worker is in a bad state, we might want to replace it.
        // For now, `WorkerWrapper` handles its own termination/reset if needed?
        // Actually, if `WorkerWrapper.initializeWorker` throws or `onerror` is fatal, we might want to remove it.
        // But `handleError` in wrapper already called `completeTask`, so it's "free" but maybe broken.

        // Let's assume for now we just terminate and replace if it fails unexpectedly
        worker.terminate();
        this.workers.delete(worker.id);

        // Trigger queue processing to replace the worker if needed
        this.processQueue();
        this.ensureMinWorkers();
    }

    private startIdleTimer(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }

        this.idleTimer = setTimeout(() => {
            this.pruneIdleWorkers();
        }, this.config.idleTimeout || 30000);
    }

    private pruneIdleWorkers(): void {
        const min = this.config.minWorkers || 1;
        if (this.workers.size <= min) return;

        const toRemove: string[] = [];

        for (const [id, worker] of this.workers.entries()) {
            if (!worker.isBusy && this.workers.size - toRemove.length > min) {
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
    }

    // Diagnostics
    public getStats() {
        return {
            totalWorkers: this.workers.size,
            busyWorkers: Array.from(this.workers.values()).filter(w => w.isBusy).length,
            idleWorkers: Array.from(this.workers.values()).filter(w => !w.isBusy).length,
            queueLength: this.taskQueue.length
        };
    }
}
