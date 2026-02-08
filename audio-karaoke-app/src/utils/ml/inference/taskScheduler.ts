export interface Task {
    id: string;
    priority: number; // Higher is better
    execute: (signal: AbortSignal) => Promise<void>;
    abortController: AbortController;
    timestamp: number;
}

export class TaskScheduler {
    private queue: Task[] = [];
    private isProcessing: boolean = false;
    private maxConcurrent: number = 1;

    constructor(maxConcurrent: number = 1) {
        this.maxConcurrent = maxConcurrent;
    }

    addTask(execute: (signal: AbortSignal) => Promise<void>, priority: number = 0): string {
        const id = crypto.randomUUID();
        const abortController = new AbortController();
        const task: Task = {
            id,
            priority,
            execute,
            abortController,
            timestamp: Date.now()
        };

        this.queue.push(task);
        this.sortQueue();

        // Trigger processing if not already running
        if (!this.isProcessing) {
            this.processQueue();
        }

        return id;
    }

    cancelTask(id: string): void {
        const index = this.queue.findIndex(t => t.id === id);
        if (index !== -1) {
            this.queue[index].abortController.abort();
            this.queue.splice(index, 1);
        }
    }

    /**
     * Preempts stale tasks or lower priority tasks if queue is full.
     * Stale definition: Task older than X seconds and not started.
     */
    preemptStaleTasks(maxAgeMs: number = 10000) {
        const now = Date.now();
        // Identify stale tasks
        const staleTasks = this.queue.filter(t => now - t.timestamp > maxAgeMs);

        // Abort and remove them
        staleTasks.forEach(t => {
            t.abortController.abort();
            const idx = this.queue.indexOf(t);
            if (idx > -1) this.queue.splice(idx, 1);
        });
    }

    private sortQueue() {
        this.queue.sort((a, b) => b.priority - a.priority);
    }

    private async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.queue.length > 0) {
            const task = this.queue.shift();
            if (!task) break;

            if (task.abortController.signal.aborted) continue;

            try {
                await task.execute(task.abortController.signal);
            } catch (e) {
                if (task.abortController.signal.aborted) {
                    console.log(`Task ${task.id} aborted.`);
                } else {
                    console.error(`Task ${task.id} failed:`, e);
                }
            }
        }

        this.isProcessing = false;
    }
}
