import { InferenceEngine } from '../inference';
import { StreamingProcessor, StreamingOptions } from './streamingProcessor';
import { TaskScheduler } from './taskScheduler';
import { InferenceOutput } from '@/types/model';

export class InferencePipeline {
    private engine: InferenceEngine;
    private scheduler: TaskScheduler;
    private streamingProcessor: StreamingProcessor;

    constructor(engine: InferenceEngine, options: Partial<StreamingOptions> = {}) {
        this.engine = engine;
        this.scheduler = new TaskScheduler(1); // Serial execution for now
        this.streamingProcessor = new StreamingProcessor(engine, options);
    }

    /**
     * Processes a full audio buffer using the streaming processor.
     * Use this for long files to process them in chunks with overlap-add.
     */
    async process(
        audioData: Float32Array,
        sampleRate: number,
        channels: number,
        priority: number = 0,
        onProgress?: (progress: number) => void,
        onChunkProcessed?: (vocals: Float32Array, instrumentals: Float32Array, chunkIndex: number, processingLatency: number) => void
    ): Promise<InferenceOutput> {
        return new Promise((resolve, reject) => {
            this.scheduler.addTask(async (signal) => {
                if (signal.aborted) {
                    reject(new Error('Aborted'));
                    return;
                }

                try {
                    const result = await this.streamingProcessor.processStream(
                        audioData,
                        sampleRate,
                        channels,
                        onProgress,
                        signal,
                        onChunkProcessed
                    );
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            }, priority);
        });
    }

    /**
     * Cancel all pending tasks.
     */
    cancelAll() {
        // Scheduler cancellation logic needs to be robust
        // Current simple scheduler allows cancelling by ID.
        // We might want to clear the whole queue.
        // For now, we rely on the caller aborting if they held the task ID,
        // but here we wrap it in a Promise.
        // This is a limitation of the current simple wrapper.
        // In a real app, we'd return an object { promise, cancel }.
    }

    dispose() {
        this.engine.dispose();
    }
}
