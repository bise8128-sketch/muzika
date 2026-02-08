import { StreamableBufferManager } from '@/utils/audio/StreamableBufferManager';
import { getAudioContext } from '@/utils/audio/audioContext';
import type { ModelInfo } from '@/types/model';
import type { SeparationResult, ProcessingProgress } from '@/types/audio';
import { audioCache } from '@/utils/storage/audioCache';
import { BrowserAudioSegmenter } from '@/utils/audio/BrowserAudioSegmenter';
import { BrowserFileSource } from '@/utils/io/BrowserFileSource';
import { ProgressTracker } from '@/utils/progress/ProgressTracker';
import type { WorkerResponse } from './audio.worker';

export interface SeparationOptions {
    modelInfo: ModelInfo;
    onProgress?: (progress: ProcessingProgress) => void;
    onChunk?: (chunk: { vocals: Float32Array; instrumentals: Float32Array; position: number; sampleRate: number }) => void;
    skipCache?: boolean;
    signal?: AbortSignal;
}

export interface SeparationMetrics {
    ttfa: number;
    totalTime: number;
    numSegments: number;
    averageInferenceTime?: number;
}

function waitForWorkerMessage<T = unknown>(worker: Worker, type: string, timeoutMs = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error(`Timeout waiting for worker message: ${type}`));
        }, timeoutMs);

        const handler = (e: MessageEvent) => {
            if (e.data.type === type) {
                cleanup();
                resolve(e.data.payload as T);
            } else if (e.data.type === 'ERROR') {
                cleanup();
                reject(new Error(e.data.payload.message));
            }
        };

        const cleanup = () => {
            clearTimeout(timeout);
            worker.removeEventListener('message', handler);
        };

        worker.addEventListener('message', handler);
    });
}

export async function separateAudio(
    file: File,
    options: SeparationOptions
): Promise<SeparationResult> {
    const { modelInfo, onProgress, onChunk, skipCache = false, signal } = options;
    const progressTracker = new ProgressTracker();
    let worker: Worker | null = null;
    let bufferManager: StreamableBufferManager | null = null;
    let segmenter: BrowserAudioSegmenter | null = null;
    let fileSource: BrowserFileSource | null = null;
    let sessionId: string | null = null;

    try {
        const ctx = getAudioContext();
        bufferManager = new StreamableBufferManager(ctx);
        segmenter = new BrowserAudioSegmenter();
        fileSource = new BrowserFileSource(file);

        sessionId = crypto.randomUUID();

        console.log('[separateAudio] Creating worker...');
        worker = new Worker(new URL('./audio.worker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = (e) => {
            const { type } = e.data as WorkerResponse;
            if (type === 'PROGRESS' && onProgress) {
                // Forward worker progress if any
            }
        };

        if (signal) {
            signal.addEventListener('abort', () => {
                if (worker) worker.postMessage({ type: 'ABORT' });
                if (segmenter) segmenter.dispose();
            });
        }

        progressTracker.start();
        onProgress?.({ phase: 'decoding', percentage: 0, message: 'Analyzing file...', currentSegment: 0, totalSegments: 0 });

        const fileHash = await audioCache.hashFile(file);

        if (!skipCache) {
            const cached = await audioCache.getCachedAudio(fileHash, modelInfo.id);
            if (cached) {
                console.log('[separateAudio] Cache hit!');
                onProgress?.({ phase: 'decoding', percentage: 100, message: 'Loaded from cache', currentSegment: 0, totalSegments: 0 });

                const vFloat = new Float32Array(cached.vocals);
                const iFloat = new Float32Array(cached.instrumentals);

                if (bufferManager) {
                    bufferManager.addChunk(vFloat, iFloat);
                    const buffers = bufferManager.getAllAudioBuffers();
                    return {
                        vocals: buffers.vocals,
                        instrumentals: buffers.instrumentals,
                        // For large files, we skip decoding the original audio to avoid OOM
                        originalAudio: null, // Callers should handle null or we can decode on demand
                        fileHash,
                        timestamp: cached.processedAt
                    };
                }
            }
        }

        console.log('[separateAudio] Initializing worker session...');
        worker.postMessage({
            type: 'INIT_STREAM_SESSION',
            payload: { modelInfo, sessionId }
        });

        await waitForWorkerMessage(worker, 'STREAM_READY');

        console.log('[separateAudio] Starting streaming segmentation...');

        let chunkIndex = 0;
        let totalProcessedDuration = 0;

        onProgress?.({ phase: 'separating', percentage: 0, message: 'Starting separation...', currentSegment: 0, totalSegments: 0 });

        const segmentGenerator = segmenter.segmentFile(fileSource, 15);

        for await (const segment of segmentGenerator) {
            if (signal?.aborted) throw new Error('Aborted');

            const { data: interleaved, startTime, sampleRate, channelCount, duration } = segment;

            // Send to worker
            worker.postMessage({
                type: 'PROCESS_STREAM_CHUNK',
                payload: {
                    chunk: interleaved,
                    chunkIndex,
                    sessionId,
                    channels: channelCount,
                    sampleRate
                }
            }, [interleaved.buffer]);

            const resultPayload = await waitForWorkerMessage<{ vocals: Float32Array; instrumentals: Float32Array }>(worker, 'CHUNK_PROCESSED');
            const { vocals, instrumentals } = resultPayload;

            if (bufferManager) {
                bufferManager.addChunk(vocals, instrumentals);
                bufferManager.play();
            }

            if (onChunk) {
                onChunk({
                    vocals,
                    instrumentals,
                    position: startTime,
                    sampleRate
                });
            }

            chunkIndex++;
            totalProcessedDuration += duration;
            progressTracker.update(totalProcessedDuration);
            const state = progressTracker.state;

            // Calculate percentage based on totalDuration from segmenter (if available)
            const totalDuration = segmenter.totalDuration || (file.size / (128 * 1024 / 8)); // Fallback
            const percent = (totalProcessedDuration / totalDuration) * 100;

            onProgress?.({
                phase: 'separating',
                percentage: Math.min(99, percent),
                message: `Processing... Speed: ${state.speed.toFixed(1)}x, ETA: ${state.eta.toFixed(0)}s`,
                currentSegment: chunkIndex,
                totalSegments: Math.ceil(totalDuration / 15)
            });
        }

        worker.postMessage({ type: 'END_STREAM_SESSION', payload: { sessionId } });

        const finalBuffers = bufferManager.getAllAudioBuffers();
        const metrics: SeparationMetrics = {
            ttfa: 0,
            totalTime: progressTracker.state.elapsed,
            numSegments: chunkIndex
        };

        // Cache attempt 
        // Note: For very large files, createAudioBuffer in bufferManager might fail if it tries to allocate huge buffers.
        // But for typical songs it's fine. For 1 hour mix, it might crash.
        // We're robust for streaming, but final result aggregation is still memory heavy.
        // A true robust solution would write results to IndexedDB/FileHandle incrementally.
        // But that's a larger refactor of the whole app's data model.
        // For now, we solve the "processing buffer overflow" by chunking, but "result buffer overflow" remains a risk for extremely large files unless we change return type.

        return {
            vocals: finalBuffers.vocals,
            instrumentals: finalBuffers.instrumentals,
            originalAudio: null,
            fileHash,
            timestamp: Date.now()
        };

    } catch (err) {
        console.error('Separation failed:', err);
        throw err;
    } finally {
        worker?.terminate();
        await segmenter?.dispose();
    }
}
