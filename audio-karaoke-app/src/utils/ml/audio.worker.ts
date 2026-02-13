/**
 * Web Worker for Audio Separation
 * Handles heavy processing off the main thread to keep UI responsive.
 */

import { audioCache } from '@/utils/storage/audioCache';
import { segmentAudio, applyCrossfade } from '@/utils/audio/audioProcessor';
import { loadModel } from './modelManager';
import { processAudioInChunks, InferenceEngine } from './inference';
import { InferencePipeline } from './inference/pipeline';
import type { ModelInfo } from '@/types/model';
import type { ProcessingProgress } from '@/types/audio';
import { bufferPool } from '../audio/bufferPool';

/**
 * Metrics returned from the separation process
 */
export interface SeparationMetrics {
    ttfa: number;
    totalTime: number;
    numSegments: number;
    averageInferenceTime?: number;
}

import type { ExecutionBackend } from '@/types/model';

// Define worker message types
export type WorkerMessage =
    | { type: 'START_SEPARATION'; payload: SeparationRequest }
    | { type: 'INIT_STREAM_SESSION'; payload: { modelInfo: ModelInfo; sessionId: string } }
    | { type: 'PROCESS_STREAM_CHUNK'; payload: { chunk: Float32Array; chunkIndex: number; sessionId: string; channels: number; sampleRate: number } }
    | { type: 'END_STREAM_SESSION'; payload: { sessionId: string } }
    | { type: 'ABORT' };

export interface SeparationRequest {
    file: File;
    decodedData: { left: Float32Array; right: Float32Array };
    sampleRate: number;
    modelInfo: ModelInfo;
    skipCache?: boolean;
}

export type WorkerResponse =
    | { type: 'PROGRESS'; payload: ProcessingProgress }
    | { type: 'CHUNK_PLAYBACK'; payload: { vocals: Float32Array; instrumentals: Float32Array; position: number } }
    | { type: 'COMPLETE'; payload: { vocals: ArrayBuffer; instrumentals: ArrayBuffer; fileHash: string; timestamp: number; metrics?: SeparationMetrics } }
    | { type: 'STREAM_READY'; payload: { sessionId: string; backend?: ExecutionBackend } }
    | { type: 'CHUNK_PROCESSED'; payload: { vocals: Float32Array; instrumentals: Float32Array; chunkIndex: number; sessionId: string } }
    | { type: 'ERROR'; payload: { message: string } };

// Helper to send progress
interface WorkerScope {
    postMessage(message: unknown, transfer?: Transferable[]): void;
}
const ctx = self as unknown as WorkerScope;

const sendProgress = (progress: ProcessingProgress) => {
    ctx.postMessage({ type: 'PROGRESS', payload: progress });
};

let abortController: AbortController | null = null;
let isAborted = false;
let activeSession: { id: string; engine: InferenceEngine } | null = null;

// Interface for SimpleAudioBuffer used in segmentAudio
interface SimpleAudioBuffer {
    sampleRate: number;
    numberOfChannels: number;
    length: number;
    duration: number;
    getChannelData(channel: number): Float32Array;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { type } = e.data;
    // console.log('[audio.worker] Worker message received:', type);

    if (type === 'ABORT') {
        console.log('[audio.worker] Abort signal received');
        isAborted = true;
        if (abortController) {
            abortController.abort();
        }
        if (activeSession) {
            activeSession.engine.dispose();
            activeSession = null;
        }
        return;
    }

    if (type === 'INIT_STREAM_SESSION') {
        const { modelInfo, sessionId } = e.data.payload;
        console.log('[audio.worker] Initializing stream session:', sessionId, 'Model:', modelInfo.id);

        try {
            console.log('[audio.worker] Loading model...');
            const engine = await loadModel(modelInfo);
            console.log('[audio.worker] Model loaded successfully');
            
            activeSession = { id: sessionId, engine };
            const backend = engine.backendInfo?.backend;
            
            console.log('[audio.worker] Session initialized, sending STREAM_READY with backend:', backend);
            ctx.postMessage({ type: 'STREAM_READY', payload: { sessionId, backend } });
        } catch (err) {
            const errorMsg = `Failed to load model: ${(err as Error).message}`;
            console.error('[audio.worker]', errorMsg, err);
            ctx.postMessage({ type: 'ERROR', payload: { message: errorMsg } });
        }
        return;
    }

    if (type === 'PROCESS_STREAM_CHUNK') {
        const { chunk, chunkIndex, sessionId, channels, sampleRate } = e.data.payload;
        console.log(`[audio.worker] Processing chunk ${chunkIndex} for session ${sessionId}`);

        if (!activeSession || activeSession.id !== sessionId) {
            const errorMsg = `Session not initialized or mismatch. Active: ${activeSession?.id}, Requested: ${sessionId}`;
            console.error(`[audio.worker] ${errorMsg}`);
            ctx.postMessage({ type: 'ERROR', payload: { message: errorMsg } });
            return;
        }

        try {
            console.log(`[audio.worker] Calling engine.processChunk for chunk ${chunkIndex}...`);
            const result = await activeSession.engine.processChunk(chunk, channels, sampleRate);
            console.log(`[audio.worker] Chunk ${chunkIndex} processed successfully`);

            ctx.postMessage({
                type: 'CHUNK_PROCESSED',
                payload: {
                    vocals: result.vocals,
                    instrumentals: result.instrumentals,
                    chunkIndex,
                    sessionId
                }
            }, [result.vocals.buffer as ArrayBuffer, result.instrumentals.buffer as ArrayBuffer]); // Transfer buffers
            console.log(`[audio.worker] Sent CHUNK_PROCESSED message for chunk ${chunkIndex}`);
        } catch (err) {
            const errorMsg = `Error processing chunk ${chunkIndex}: ${(err as Error).message}`;
            console.error(`[audio.worker] ${errorMsg}`, err);
            ctx.postMessage({ type: 'ERROR', payload: { message: errorMsg } });
        }
        return;
    }

    if (type === 'END_STREAM_SESSION') {
        const { sessionId } = e.data.payload;
        if (activeSession && activeSession.id === sessionId) {
            activeSession.engine.dispose();
            activeSession = null;
        }
        return;
    }
    if (type === 'START_SEPARATION') {
        const { file, decodedData, sampleRate, modelInfo, skipCache } = e.data.payload;
        console.log('[audio.worker] Starting separation for file:', file.name, 'model:', modelInfo.id);

        // Reset abort state
        isAborted = false;
        abortController = new AbortController();

        try {
            // Phase 1: Generate file hash
            sendProgress({ phase: 'loading-model', currentSegment: 0, totalSegments: 0, percentage: 0, message: 'Generating file hash...' });
            if (isAborted) throw new Error('Processing aborted by user');
            const fileHash = await audioCache.hashFile(file);

            // Phase 2: Check cache
            if (!skipCache) {
                sendProgress({ phase: 'loading-model', currentSegment: 0, totalSegments: 0, percentage: 5, message: 'Checking cache...' });
                const cached = await audioCache.getCachedAudio(fileHash, modelInfo.id);

                if (cached) {
                    sendProgress({ phase: 'loading-model', currentSegment: 0, totalSegments: 0, percentage: 100, message: 'Loading from cache...' });

                    self.postMessage({
                        type: 'COMPLETE',
                        payload: {
                            vocals: cached.vocals,
                            instrumentals: cached.instrumentals,
                            fileHash,
                            timestamp: cached.processedAt
                        }
                    });
                    return;
                }
            }

            // Phase 3: Load model
            sendProgress({ phase: 'loading-model', currentSegment: 0, totalSegments: 0, percentage: 10, message: 'Loading AI model...' });
            if (isAborted) throw new Error('Processing aborted by user');

            const engine = await loadModel(modelInfo, (progress) => {
                sendProgress({
                    phase: 'loading-model',
                    currentSegment: 0,
                    totalSegments: 0,
                    percentage: 10 + (progress.percentage * 0.2),
                    message: `Downloading model: ${progress.percentage.toFixed(0)}%`
                });
            }) as unknown as InferenceEngine;

            if (isAborted) throw new Error('Processing aborted by user');

            // Phase 4: Initialize High-Performance Pipeline
            sendProgress({ phase: 'segmenting', currentSegment: 0, totalSegments: 0, percentage: 35, message: 'Initializing pipeline...' });
            const pipeline = new InferencePipeline(engine, { overlap: 2.0, maxChunkSize: 30.0 });

            // Interleave input audio for the pipeline
            const length = decodedData.left.length;
            const interleavedInput = new Float32Array(length * 2);
            for (let i = 0; i < length; i++) {
                interleavedInput[i * 2] = decodedData.left[i];
                interleavedInput[i * 2 + 1] = decodedData.right[i];
            }

            performance.mark('start-separation');

            // Phase 5: Inference with Dynamic Chunking and Overlap-Add
            const result = await pipeline.process(
                interleavedInput,
                sampleRate,
                2, // channels
                1, // priority
                (progressPercentage) => {
                    const percentage = 40 + (progressPercentage * 55);
                    sendProgress({
                        phase: 'separating',
                        currentSegment: Math.floor(progressPercentage * 100),
                        totalSegments: 100,
                        percentage,
                        message: `Separating audio... ${Math.round(percentage)}%`
                    });
                },
                (vChunk, iChunk, idx) => {
                    if (idx === 0) {
                        performance.mark('ttfa');
                        try {
                            performance.measure('time-to-first-audio', 'start-separation', 'ttfa');
                        } catch (e) { /* ignore */ }
                    }
                    // For streaming playback, we could de-interleave and send CHUNK_PLAYBACK here
                }
            );

            // Phase 6: Complete & Metrics
            sendProgress({ phase: 'caching', currentSegment: 100, totalSegments: 100, percentage: 100, message: 'Complete!' });

            // Collect metrics
            const ttfaEntry = performance.getEntriesByName('time-to-first-audio')[0];
            const metrics: SeparationMetrics = {
                ttfa: ttfaEntry?.duration || 0,
                totalTime: performance.now() - performance.getEntriesByName('start-separation')[0].startTime,
                numSegments: Math.ceil(length / (sampleRate * 30)) // Rough estimate
            };

            // Prepare results (de-interleaving for storage/output if necessary, or just send interleaved)
            // Most audio players expect planar, but some can handle interleaved.
            // Let's assume we send the buffers as they are.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (self as any).postMessage({
                type: 'COMPLETE',
                payload: {
                    vocals: result.vocals.buffer,
                    instrumentals: result.instrumentals.buffer,
                    fileHash,
                    timestamp: Date.now(),
                    metrics
                }
            }, [result.vocals.buffer, result.instrumentals.buffer]);

            pipeline.dispose();

        } catch (error) {
            console.error('[audio.worker] Error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage === 'Processing aborted by user') return;

            self.postMessage({
                type: 'ERROR',
                payload: { message: errorMessage }
            });
        }
    }
};

self.onerror = (event) => {
    console.error('[audio.worker] Uncaught Global Error:', event);
    const msg = event instanceof ErrorEvent ? event.message : 'Unknown worker error';
    
    // Attempt to report back to main thread
    try {
        ctx.postMessage({ 
            type: 'ERROR', 
            payload: { message: `Uncaught worker error: ${msg}` } 
        });
    } catch (e) {
        console.error('[audio.worker] Failed to report error:', e);
    }
};

self.onunhandledrejection = (event) => {
    console.error('[audio.worker] Unhandled Rejection:', event.reason);
    try {
        ctx.postMessage({ 
            type: 'ERROR', 
            payload: { message: `Unhandled rejection: ${event.reason}` } 
        });
    } catch (e) {
        console.error('[audio.worker] Failed to report rejection:', e);
    }
};
