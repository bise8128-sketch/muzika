import { StreamableBufferManager } from '@/utils/audio/StreamableBufferManager';
import { getAudioContext } from '@/utils/audio/audioContext';
import { ModelType, ModelInfo } from '@/types/model';
import type { SeparationResult, ProcessingProgress } from '@/types/audio';
import { audioCache } from '@/utils/storage/audioCache';
import { BrowserAudioSegmenter } from '@/utils/audio/BrowserAudioSegmenter';
import { BrowserFileSource } from '@/utils/io/BrowserFileSource';
import { ProgressTracker } from '@/utils/progress/ProgressTracker';
import { StorageManager } from '@/utils/storage/StorageManager';

/**
 * A lightweight wrapper around a single Web Worker for stateful session messaging.
 * Unlike WorkerPool, this pins ALL messages to one worker instance, which is required
 * by audio.worker.ts since `activeSession` state is per-worker.
 *
 * Sends are serialized via an internal queue since the worker is single-threaded —
 * responses always arrive in FIFO order. Callers can still use Promise.all for
 * concurrency; their promises resolve in order as the worker completes each task.
 */
class SessionWorker {
    private worker: Worker;
    private pendingResolve: ((value: unknown) => void) | null = null;
    private pendingReject: ((reason: Error) => void) | null = null;
    private progressHandler: ((progress: number) => void) | null = null;
    private inFlight = false;

    // Queue of sends waiting for the worker to become free
    private queue: Array<{
        type: string;
        payload: unknown;
        transferables: Transferable[];
        onProgress?: (p: number) => void;
        resolve: (v: unknown) => void;
        reject: (e: Error) => void;
    }> = [];

    constructor() {
        this.worker = new Worker(
            new URL('./audio.worker.ts', import.meta.url),
            { type: 'module' }
        );
        this.worker.onmessage = (e: MessageEvent) => this.handleMessage(e);
        this.worker.onerror = (e: ErrorEvent) => this.handleError(e);
    }

    private handleMessage(event: MessageEvent): void {
        const { type, payload } = event.data;
        if (type === 'ERROR' || type === 'FAILED') {
            this.pendingReject?.(new Error(payload?.message || 'Unknown worker error'));
            this.pendingResolve = null;
            this.pendingReject = null;
            this.flushQueue();
        } else if (type === 'PROGRESS') {
            const value = typeof payload === 'number'
                ? payload
                : (payload?.percentage ?? payload?.progress);
            if (typeof value === 'number') this.progressHandler?.(value);
            // PROGRESS does NOT complete the task — do NOT flush here
        } else {
            // SUCCESS / COMPLETE / STREAM_READY / CHUNK_PROCESSED / etc.
            this.pendingResolve?.(payload);
            this.pendingResolve = null;
            this.pendingReject = null;
            this.flushQueue();
        }
    }

    private handleError(e: ErrorEvent): void {
        this.pendingReject?.(new Error(`Worker error: ${e.message}`));
        this.pendingResolve = null;
        this.pendingReject = null;
        this.flushQueue();
    }

    private flushQueue(): void {
        this.inFlight = false;
        if (this.queue.length === 0) return;
        this.dispatch(this.queue.shift()!);
    }

    private dispatch(item: typeof this.queue[number]): void {
        this.inFlight = true;
        this.pendingResolve = item.resolve;
        this.pendingReject = item.reject;
        this.progressHandler = item.onProgress ?? null;
        this.worker.postMessage({ type: item.type, payload: item.payload }, item.transferables);
    }

    send<TResult>(
        type: string,
        payload: unknown,
        transferables: Transferable[] = [],
        onProgress?: (p: number) => void
    ): Promise<TResult> {
        return new Promise<TResult>((resolve, reject) => {
            const item = {
                type,
                payload,
                transferables,
                onProgress,
                resolve: resolve as (v: unknown) => void,
                reject
            };
            if (this.inFlight) {
                this.queue.push(item);
            } else {
                this.dispatch(item);
            }
        });
    }

    terminate(): void {
        this.worker.terminate();
    }
}

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



export async function separateAudio(
    file: File,
    options: SeparationOptions
): Promise<SeparationResult> {
    const sessionWorker = new SessionWorker();
    try {
        return await separateAudioInternal(file, options, sessionWorker);
    } finally {
        sessionWorker.terminate();
    }
}

async function separateAudioInternal(
    file: File,
    options: SeparationOptions,
    sessionWorker: SessionWorker
): Promise<SeparationResult> {
    console.log('[separateAudioInternal] Executing fresh version');
    if (typeof window === 'undefined') {
        throw new Error('separateAudio must be called in a browser environment');
    }
    const { modelInfo, onProgress, onChunk, skipCache = false, signal } = options;
    const progressTracker = new ProgressTracker();
    let bufferManager: StreamableBufferManager | null = null;
    let segmenter: BrowserAudioSegmenter | null = null;
    let fileSource: BrowserFileSource | null = null;
    let sessionId: string | null = null;

    try {
        const fileHash = await audioCache.hashFile(file);
        const serverModels = [ModelType.HTDEMUCS, ModelType.HTDEMUCS_FT, ModelType.BS_ROFORMER];



        const support = await checkONNXSupport();
        
        // Smart Routing:
        // 1. If model requires server (HTDEMUCS/BS_ROFORMER), always use server.
        // 2. If device is low-end (e.g. mobile/weak CPU) AND server is available, use server to avoid crashing browser.
        // 3. Otherwise, use client-side (WebGPU/WASM).
        
        let shouldUseServer = serverModels.includes(modelInfo.type);
        
        if (!shouldUseServer && support.isLowEnd) {
             const available = await isServerAvailable();
             if (available) {
                 console.log('[separateAudio] Low-end device detected & server available. Offloading to server.');
                 shouldUseServer = true;
             }
        }

        if (shouldUseServer) {
            try {
                return await serverSeparateAudio(file, options, fileHash);
            } catch (err) {
                // If it was a mandatory server model, we must fail
                if (serverModels.includes(modelInfo.type)) {
                    throw err;
                }
                
                // If it was an optimization (low-end device), we can fall back to client
                console.warn('[separateAudio] Server unavailable or failed, falling back to client-side processing:', err);
                onProgress?.({ 
                    phase: 'decoding', 
                    percentage: 0, 
                    message: 'Server unavailable. Falling back to local processing...', 
                    currentSegment: 0, 
                    totalSegments: 0,
                    executionBackend: 'wasm' 
                });
                // Fall through to client-side logic
            }
        } else if (!support.webgpu) {
            // Explicitly report WASM if we know WebGPU isn't available before worker starts
            onProgress?.({ 
                phase: 'decoding', 
                percentage: 0, 
                message: 'Initializing local processing...', 
                currentSegment: 0, 
                totalSegments: 0,
                executionBackend: 'wasm' 
            });
        }

        const ctx = getAudioContext();
        bufferManager = new StreamableBufferManager(ctx);
        segmenter = new BrowserAudioSegmenter();
        fileSource = new BrowserFileSource(file);

        sessionId = crypto.randomUUID();

        onProgress?.({ phase: 'decoding', percentage: 0, message: 'Analyzing file...', currentSegment: 0, totalSegments: 0 });

        const abortHandler = () => {
            if (segmenter) segmenter.dispose();
        };
        if (signal) {
            signal.addEventListener('abort', abortHandler, { once: true });
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const initResult = await sessionWorker.send<{ sessionId: string; backend?: 'webgpu' | 'wasm' | 'server' }>(
            'INIT_STREAM_SESSION',
            { modelInfo, sessionId }
        );
        
        const executionBackend = initResult.backend || 'wasm';
        console.log(`[separateAudio] Worker using backend: ${executionBackend}`);
        
        // Report backend immediately and ensure it persists
        onProgress?.({ 
            phase: 'decoding', 
            percentage: 5, 
            message: `Initializing AI model... (${executionBackend === 'webgpu' ? 'WebGPU' : 'WASM'})`, 
            currentSegment: 0, 
            totalSegments: 0,
            executionBackend 
        });

        console.log('[separateAudio] Starting streaming segmentation...');

        let chunkIndex = 0;
        let totalProcessedDuration = 0;

        onProgress?.({ 
            phase: 'separating', 
            percentage: 0, 
            message: 'Starting separation...', 
            currentSegment: 0, 
            totalSegments: 0,
            executionBackend
        });

        const segmentGenerator = segmenter.segmentFile(fileSource, 5);
        const processingPromises: Promise<void>[] = [];
        let nextChunkToPlay = 0;
        const processedChunks = new Map<number, { vocals: Float32Array; instrumentals: Float32Array; startTime: number; sampleRate: number }>();

        for await (const segment of segmentGenerator) {
            if (signal?.aborted) throw new Error('Aborted');

            const currentIdx = chunkIndex;
            const { data: interleaved, startTime, sampleRate, channelCount, duration } = segment;

            console.log(`[separateAudio] Dispatching chunk ${currentIdx} to pool`);
            
            const taskPromise = sessionWorker.send<{ 
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
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const totalDuration = segmenter!.totalDuration || (file.size / (128 * 1024 / 8));
                const percent = (totalProcessedDuration / totalDuration) * 100;

                onProgress?.({
                    phase: 'separating',
                    percentage: Math.min(99, percent),
                    message: `Processing... Speed: ${state.speed.toFixed(1)}x, ETA: ${state.eta.toFixed(0)}s`,
                    currentSegment: nextChunkToPlay,
                    totalSegments: Math.ceil(totalDuration / 5),
                    executionBackend
                });
            });

            processingPromises.push(taskPromise);
            chunkIndex++;
        }

        await Promise.all(processingPromises);
        await sessionWorker.send('END_STREAM_SESSION', { sessionId });

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
                // Serialize all channels interleaved for stereo-safe caching
                const serializeBuffer = (audioBuffer: AudioBuffer): ArrayBuffer => {
                    const channels = audioBuffer.numberOfChannels;
                    const length = audioBuffer.length;
                    const interleaved = new Float32Array(length * channels);
                    for (let ch = 0; ch < channels; ch++) {
                        const channelData = audioBuffer.getChannelData(ch);
                        for (let i = 0; i < length; i++) {
                            interleaved[i * channels + ch] = channelData[i];
                        }
                    }
                    return interleaved.buffer;
                };

                const vocalsBuffer = serializeBuffer(finalBuffers.vocals);
                const instrumentalsBuffer = serializeBuffer(finalBuffers.instrumentals);

                await StorageManager.runWithRetry(
                    () => audioCache.cacheAudioResult(
                        fileHash,
                        file.name,
                        file.size,
                        vocalsBuffer,
                        instrumentalsBuffer,
                        segmenter!.totalDuration || 0,
                        ctx.sampleRate,
                        modelInfo.id
                    ),
                    `Caching audio results for ${file.name}`
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
            timestamp: Date.now(),
            executionBackend
        };

    } catch (err: unknown) {
        const errObj = err instanceof Error ? err : new Error(String(err));
        console.error('Separation failed:', errObj);
        if (errObj.message === 'window is not defined' || errObj.message.includes('window is not defined')) {
             throw new Error('Separation failed: Browser environment required (window is undefined).');
        }
        throw errObj;
    } finally {
        await segmenter?.dispose();
    }
}

// Helper to check server availability
async function isServerAvailable(): Promise<boolean> {
    try {
        // Use a short timeout to not block UI
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('/api/status', { signal: controller.signal });
        clearTimeout(id);
        return res.ok;
    } catch (e) {
        return false;
    }
}

import { checkONNXSupport } from './onnxSetup';

async function serverSeparateAudio(
    file: File,
    options: SeparationOptions,
    fileHash: string
): Promise<SeparationResult> {
    const { modelInfo, onProgress, signal } = options;


    try {
        onProgress?.({ 
            phase: 'decoding', 
            percentage: 0, 
            message: 'Uploading to server...', 
            currentSegment: 0, 
            totalSegments: 0,
            executionBackend: 'server'
        });

        // 1. Upload file
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/backend-upload', {
            method: 'POST',
            body: formData,
            signal
        });

        if (!uploadRes.ok) {
            const err = await uploadRes.json();
            throw new Error(err.error || 'Upload failed');
        }

        const uploadData = await uploadRes.json();
        const filename = uploadData.filename;

        onProgress?.({ 
            phase: 'separating', 
            percentage: 10, 
            message: 'Starting server-side separation...', 
            currentSegment: 0, 
            totalSegments: 0,
            executionBackend: 'server' 
        });

        // 2. Start separation
        const processRes = await fetch('/api/python-processing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, model: modelInfo.id }),
            signal
        });

        if (!processRes.ok) {
            const err = await processRes.json();
            throw new Error(err.error || 'Separation request failed');
        }

        const processData = await processRes.json();

        let stems = processData.stems;

        // Async Polling logic
        if (processData.status === 'processing' || !stems) {
             if (!processData.jobId) throw new Error('Server returned processing status but no jobId');
             console.log(`[serverSeparateAudio] Job ${processData.jobId} queued. Polling...`);
             stems = await pollJobStatus(processData.jobId, onProgress, signal);
        }

        onProgress?.({ 
            phase: 'separating', 
            percentage: 100, 
            message: 'Separation complete!', 
            currentSegment: 0, 
            totalSegments: 0,
            executionBackend: 'server' 
        });

        // Fetch and decode stems using shared AudioContext
        const ctx = getAudioContext();

        const fetchAndDecode = async (url: string) => {
            const res = await fetch(url, { signal });
            const arrayBuffer = await res.arrayBuffer();
            return await ctx.decodeAudioData(arrayBuffer);
        };

        const [vocals, instrumentals] = await Promise.all([
            fetchAndDecode(stems.vocals),
            fetchAndDecode(stems.other || stems.instrumental || stems.accompaniment)
        ]);

        return {
            vocals,
            instrumentals,
            originalAudio: null,
            fileHash,
            timestamp: Date.now(),
            executionBackend: 'server'
        };

    } catch (err) {
        console.error('[serverSeparateAudio] Error:', err);
        throw err;
    }
}

async function pollJobStatus(
    jobId: string, 
    onProgress?: (p: ProcessingProgress) => void,
    signal?: AbortSignal
): Promise<Record<string, string>> {
     let attempts = 0;
     const maxAttempts = 120; // 10 minutes (5s interval)
     
     while (attempts < maxAttempts) {
         if (signal?.aborted) throw new Error('Aborted');
         
         // Interruptible delay
         await new Promise<void>((resolve, reject) => {
             const timeoutId = setTimeout(() => {
                 resolve();
                 signal?.removeEventListener('abort', onAbort);
             }, 5000);

             const onAbort = () => {
                 clearTimeout(timeoutId);
                 reject(new Error('Aborted'));
             };

             if (signal?.aborted) {
                 onAbort();
             } else {
                 signal?.addEventListener('abort', onAbort, { once: true });
             }
         });
         
         const res = await fetch(`/api/python-processing?jobId=${jobId}`, { signal });
         if (!res.ok) throw new Error('Status check failed');
         
         const data = await res.json();
         
         if (data.status === 'completed') {
             return data.stems;
         }
         
         if (data.status === 'failed') {
             throw new Error(data.error || 'Server processing failed');
         }
         
         // Update progress if server provides it (future) - for now just fake incremental progress
         onProgress?.({ 
             phase: 'separating', 
             percentage: 10 + Math.min(80, (attempts / 20) * 80), // Fake progress 
             message: 'Server processing...', 
             currentSegment: 0, 
             totalSegments: 0,
             executionBackend: 'server'
         });
         
         attempts++;
     }
     
     throw new Error('Server processing timed out');
}

