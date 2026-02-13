import { StreamableBufferManager } from '@/utils/audio/StreamableBufferManager';
import { getAudioContext } from '@/utils/audio/audioContext';
import { ModelType, ModelInfo } from '@/types/model';
import type { SeparationResult, ProcessingProgress } from '@/types/audio';
import { audioCache } from '@/utils/storage/audioCache';
import { BrowserAudioSegmenter } from '@/utils/audio/BrowserAudioSegmenter';
import { BrowserFileSource } from '@/utils/io/BrowserFileSource';
import { ProgressTracker } from '@/utils/progress/ProgressTracker';
import { WorkerPool } from '@/utils/worker/WorkerPool';
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

function waitForWorkerMessage<T = unknown>(worker: Worker, type: string, timeoutMs = 300000): Promise<T> {
    return new Promise((resolve, reject) => {
        console.log(`[waitForWorkerMessage] Waiting for message type: ${type}, timeout: ${timeoutMs}ms`);
        const timeout = setTimeout(() => {
            cleanup();
            console.error(`[waitForWorkerMessage] TIMEOUT waiting for: ${type}`);
            reject(new Error(`Timeout waiting for worker message: ${type}`));
        }, timeoutMs);

        const handler = (e: MessageEvent) => {
            console.log(`[waitForWorkerMessage] Received message type: ${e.data.type}, waiting for: ${type}`);
            if (e.data.type === type) {
                cleanup();
                console.log(`[waitForWorkerMessage] Received expected message: ${type}`);
                resolve(e.data.payload as T);
            } else if (e.data.type === 'ERROR') {
                cleanup();
                console.error(`[waitForWorkerMessage] Worker error:`, e.data.payload.message);
                reject(new Error(e.data.payload.message));
            }
        };

        const errorHandler = (e: ErrorEvent) => {
            cleanup();
            console.error(`[waitForWorkerMessage] Worker error event:`, e.message);
            reject(new Error(`Worker error: ${e.message}`));
        };

        const cleanup = () => {
            clearTimeout(timeout);
            worker.removeEventListener('message', handler);
            worker.removeEventListener('error', errorHandler);
        };

        worker.addEventListener('message', handler);
        worker.addEventListener('error', errorHandler);
    });
}

export async function separateAudio(
    file: File,
    options: SeparationOptions
): Promise<SeparationResult> {
    const hardwareConcurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
    const maxWorkers = Math.min(hardwareConcurrency, 4); // Limit to 4 to avoid overhead/resource contention
    
    const workerPool = new WorkerPool({
        workerScript: new URL('./audio.worker.ts', import.meta.url),
        maxWorkers
    });

    try {
        const result = await separateAudioInternal(file, options, workerPool);
        return result;
    } finally {
        workerPool.terminate();
    }
}

async function separateAudioInternal(
    file: File,
    options: SeparationOptions,
    workerPool: WorkerPool
): Promise<SeparationResult> {
    if (typeof window === "undefined") {
        // This function should not be called on the server
        // Return a dummy promise that never resolves or rejects
        return new Promise(() => {});
    }
    const { modelInfo, onProgress, onChunk, skipCache = false, signal } = options;
    const progressTracker = new ProgressTracker();
    let bufferManager: StreamableBufferManager | null = null;
    let segmenter: BrowserAudioSegmenter | null = null;
    let fileSource: BrowserFileSource | null = null;
    let sessionId: string | null = null;

    // Additional safety check for window
    if (typeof window === 'undefined') {
        throw new Error('separateAudio must be called in a browser environment');
    }

    try {
        const fileHash = await audioCache.hashFile(file);
        const serverModels = [ModelType.HTDEMUCS, ModelType.HTDEMUCS_FT, ModelType.BS_ROFORMER];

        if (serverModels.includes(modelInfo.type)) {
            return serverSeparateAudio(file, options, fileHash);
        }

        const ctx = getAudioContext();
        bufferManager = new StreamableBufferManager(ctx);
        segmenter = new BrowserAudioSegmenter();
        fileSource = new BrowserFileSource(file);

        sessionId = crypto.randomUUID();

        onProgress?.({ phase: 'decoding', percentage: 0, message: 'Analyzing file...', currentSegment: 0, totalSegments: 0 });

        if (signal) {
            signal.addEventListener('abort', () => {
                if (segmenter) segmenter.dispose();
            });
        }

        progressTracker.start();
        onProgress?.({ phase: 'decoding', percentage: 0, message: 'Analyzing file...', currentSegment: 0, totalSegments: 0 });

        // fileHash is already calculated above

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
        await workerPool.addTask('INIT_STREAM_SESSION', { modelInfo, sessionId }, 'HIGH');

        console.log('[separateAudio] Starting streaming segmentation...');

        let chunkIndex = 0;
        let totalProcessedDuration = 0;

        onProgress?.({ phase: 'separating', percentage: 0, message: 'Starting separation...', currentSegment: 0, totalSegments: 0 });

        const segmentGenerator = segmenter.segmentFile(fileSource, 5);
        const processingPromises: Promise<void>[] = [];
        let nextChunkToPlay = 0;
        const processedChunks = new Map<number, { vocals: Float32Array; instrumentals: Float32Array; startTime: number; sampleRate: number }>();

        for await (const segment of segmentGenerator) {
            if (signal?.aborted) throw new Error('Aborted');

            const currentIdx = chunkIndex;
            const { data: interleaved, startTime, sampleRate, channelCount, duration } = segment;

            console.log(`[separateAudio] Dispatching chunk ${currentIdx} to pool`);
            
            const taskPromise = workerPool.addTask<{ 
                chunk: Float32Array; 
                chunkIndex: number; 
                sessionId: string; 
                channels: number; 
                sampleRate: number 
            }, { 
                vocals: Float32Array; 
                instrumentals: Float32Array; 
                chunkIndex: number 
            }>(
                'PROCESS_STREAM_CHUNK',
                {
                    chunk: interleaved,
                    chunkIndex: currentIdx,
                    sessionId,
                    channels: channelCount,
                    sampleRate
                },
                'NORMAL',
                (typeof SharedArrayBuffer !== 'undefined' && interleaved.buffer instanceof SharedArrayBuffer)
                    ? []
                    : [interleaved.buffer]
            ).then(result => {
                processedChunks.set(result.chunkIndex, {
                    vocals: result.vocals,
                    instrumentals: result.instrumentals,
                    startTime,
                    sampleRate
                });

                // Check if we can play any consecutive chunks
                while (processedChunks.has(nextChunkToPlay)) {
                    const chunkData = processedChunks.get(nextChunkToPlay)!;
                    processedChunks.delete(nextChunkToPlay);

                    if (bufferManager) {
                        bufferManager.addChunk(chunkData.vocals, chunkData.instrumentals);
                        bufferManager.play();
                    }

                    if (onChunk) {
                        onChunk({
                            vocals: chunkData.vocals,
                            instrumentals: chunkData.instrumentals,
                            position: chunkData.startTime,
                            sampleRate: chunkData.sampleRate
                        });
                    }
                    nextChunkToPlay++;
                }

                totalProcessedDuration += duration;
                progressTracker.update(totalProcessedDuration);
                const state = progressTracker.state;
                const totalDuration = segmenter.totalDuration || (file.size / (128 * 1024 / 8));
                const percent = (totalProcessedDuration / totalDuration) * 100;

                onProgress?.({
                    phase: 'separating',
                    percentage: Math.min(99, percent),
                    message: `Processing... Speed: ${state.speed.toFixed(1)}x, ETA: ${state.eta.toFixed(0)}s`,
                    currentSegment: nextChunkToPlay,
                    totalSegments: Math.ceil(totalDuration / 5)
                });
            });

            processingPromises.push(taskPromise);
            chunkIndex++;
        }

        await Promise.all(processingPromises);
        await workerPool.addTask('END_STREAM_SESSION', { sessionId }, 'NORMAL');

        const finalBuffers = bufferManager.getAllAudioBuffers();

        // Cache attempt
        // Note: For very large files, createAudioBuffer in bufferManager might fail if it tries to allocate huge buffers.
        // But for typical songs it's fine. For 1 hour mix, it might crash.
        // We're robust for streaming, but final result aggregation is still memory heavy.
        // A true robust solution would write results to IndexedDB/FileHandle incrementally.
        // But that's a larger refactor of the whole app's data model.
        // For now, we solve the "processing buffer overflow" by chunking, but "result buffer overflow" remains a risk for extremely large files unless we change return type.

        if (!skipCache) {
            try {
                // AudioBuffer doesn't expose the raw buffer directly in a standard way that represents all channels interleaved
                // We use the first channel's buffer as a proxy for storage, assuming cache handles it or we accept mono for now
                // TODO: Properly serialize multi-channel AudioBuffer
                const vocalsBuffer = finalBuffers.vocals.getChannelData(0).buffer;
                const instrumentalsBuffer = finalBuffers.instrumentals.getChannelData(0).buffer;

                await audioCache.cacheAudioResult(
                    fileHash,
                    file.name,
                    file.size,
                    vocalsBuffer,
                    instrumentalsBuffer,
                    segmenter.totalDuration || 0,
                    ctx.sampleRate,
                    modelInfo.id
                );
            } catch (cacheError) {
                console.warn('[separateAudio] Failed to cache results:', cacheError);
            }
        }

        return {
            vocals: finalBuffers.vocals,
            instrumentals: finalBuffers.instrumentals,
            originalAudio: null,
            fileHash,
            timestamp: Date.now()
        };

    } catch (err: any) {
        console.error('Separation failed:', err);
        if (err?.message === 'window is not defined' || err?.toString().includes('window is not defined')) {
             throw new Error('Separation failed: Browser environment required (window is undefined).');
        }
        throw err;
    } finally {
        // workerPool is managed by caller (separateAudio function wrapper)
        // worker?.terminate(); // removed as 'worker' is not defined here
        await segmenter?.dispose();
    }
}

async function serverSeparateAudio(
    file: File,
    options: SeparationOptions,
    fileHash: string
): Promise<SeparationResult> {
    const { modelInfo, onProgress } = options;

    try {
        onProgress?.({ phase: 'decoding', percentage: 0, message: 'Uploading to server...', currentSegment: 0, totalSegments: 0 });

        // 1. Upload file
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/backend-upload', {
            method: 'POST',
            body: formData,
        });

        if (!uploadRes.ok) {
            const err = await uploadRes.json();
            throw new Error(err.error || 'Upload failed');
        }

        const uploadData = await uploadRes.json();
        const filename = uploadData.filename;

        onProgress?.({ phase: 'separating', percentage: 10, message: 'Starting server-side separation...', currentSegment: 0, totalSegments: 0 });

        // 2. Start separation
        const processRes = await fetch('/api/python-processing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, model: modelInfo.id })
        });

        if (!processRes.ok) {
            const err = await processRes.json();
            throw new Error(err.error || 'Separation request failed');
        }

        const processData = await processRes.json();

        // If the API returns 'completed' directly (sync)
        if (processData.status === 'completed') {
            onProgress?.({ phase: 'separating', percentage: 100, message: 'Separation complete!', currentSegment: 0, totalSegments: 0 });

            // Fetch and decode stems
            const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : null;
            if (!AudioContextClass) {
                throw new Error('AudioContext not supported in this environment');
            }
            const ctx = new AudioContextClass();

            const fetchAndDecode = async (url: string) => {
                const res = await fetch(url);
                const arrayBuffer = await res.arrayBuffer();
                return await ctx.decodeAudioData(arrayBuffer);
            };

            const [vocals, instrumentals] = await Promise.all([
                fetchAndDecode(processData.stems.vocals),
                fetchAndDecode(processData.stems.other || processData.stems.instrumental || processData.stems.accompaniment)
            ]);

            return {
                vocals,
                instrumentals,
                originalAudio: null,
                fileHash,
                timestamp: Date.now()
            };
        }

        throw new Error('Async processing not yet implemented in separateAudio');

    } catch (err) {
        console.error('[serverSeparateAudio] Error:', err);
        throw err;
    }
}

