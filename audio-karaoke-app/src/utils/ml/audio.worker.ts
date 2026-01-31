/**
 * Web Worker for Audio Separation
 * Handles heavy processing off the main thread to keep UI responsive.
 */

import { hashFile, getCachedAudio, cacheAudioResult } from '@/utils/storage/audioCache';
import { segmentAudio, applyCrossfade } from '@/utils/audio/audioProcessor';
import { loadModel } from './modelManager';
import { processAudioInChunks, InferenceEngine } from './inference';
import type { ModelInfo } from '@/types/model';
import type { ProcessingProgress } from '@/types/audio';

// Define worker message types
export type WorkerMessage =
    | { type: 'START_SEPARATION'; payload: SeparationRequest }
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
    | { type: 'COMPLETE'; payload: { vocals: ArrayBuffer; instrumentals: ArrayBuffer; fileHash: string; timestamp: number } }
    | { type: 'ERROR'; payload: { message: string } };

// Helper to send progress
const sendProgress = (progress: ProcessingProgress) => {
    self.postMessage({ type: 'PROGRESS', payload: progress });
};

let abortController: AbortController | null = null;
let isAborted = false;

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
    console.log('[audio.worker] Worker message received:', type);

    if (type === 'ABORT') {
        console.log('[audio.worker] Abort signal received');
        isAborted = true;
        if (abortController) {
            abortController.abort();
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
            const fileHash = await hashFile(file);

            // Phase 2: Check cache
            if (!skipCache) {
                sendProgress({ phase: 'loading-model', currentSegment: 0, totalSegments: 0, percentage: 5, message: 'Checking cache...' });
                const cached = await getCachedAudio(fileHash);

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

            // loadModel returns the initialized InferenceEngine
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const engine = await loadModel(modelInfo, (progress) => {
                sendProgress({
                    phase: 'loading-model',
                    currentSegment: 0,
                    totalSegments: 0,
                    percentage: 10 + (progress.percentage * 0.2),
                    message: `Downloading model: ${progress.percentage.toFixed(0)}%`
                });
            }) as unknown as InferenceEngine; // Cast if needed, or trust type inference

            if (isAborted) throw new Error('Processing aborted by user');

            // Phase 4: Prepare Audio Segments
            sendProgress({ phase: 'segmenting', currentSegment: 0, totalSegments: 0, percentage: 35, message: 'Segmenting audio...' });

            const simpleBuffer: SimpleAudioBuffer = {
                sampleRate,
                numberOfChannels: 2,
                length: decodedData.left.length,
                duration: decodedData.left.length / sampleRate,
                getChannelData: (channel: number) => {
                    return channel === 0 ? decodedData.left : decodedData.right;
                }
            };

            // Estimate segment duration based on model config
            // Default to ~10s if not specified, or use hop logic
            // Note: segmentAudio handles the logic. 
            // We pass undefined for duration to let it use default or we can calculate it.
            // Let's assume segmentAudio does the right thing.
            const segments = segmentAudio(simpleBuffer);
            const totalSegments = segments.length;

            // Phase 5: Inference Loop
            // Engine is already initialized by loadModel

            // Streaming State
            let vocalsTail: Float32Array | null = null;
            let instrumentalsTail: Float32Array | null = null;
            let globalWritePosition = 0;
            const channels = 2;

            // Calculate crossfade. Assuming segments have overlap.
            // We use a safe default if we don't know the exact overlap.
            // 1024 samples is usually enough for smooth transition.
            const crossfadeFrames = 1024;

            await processAudioInChunks(
                engine,
                segments.map(s => s.data),
                2, // channels
                sampleRate,
                (current, total) => {
                    const percentage = 40 + ((current / total) * 60);
                    sendProgress({
                        phase: 'separating',
                        currentSegment: current,
                        totalSegments: total,
                        percentage,
                        message: `Separating audio... ${Math.round(percentage)}%`
                    });
                },
                (chunkResult, index) => {
                    const vocals = chunkResult.vocals;
                    const instrumentals = chunkResult.instrumentals;

                    if (index === 0) {
                        // First segment
                        // The valid part is up to (length - crossfade)
                        const safeLen = vocals.length - crossfadeFrames;

                        // We must send a copy or transfer the buffer. 
                        // slice() creates a copy.
                        const safeVocals = vocals.slice(0, safeLen);
                        const safeInstr = instrumentals.slice(0, safeLen);

                        // Use self as any to bypass TS signature mismatch for transferables
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (self as any).postMessage({
                            type: 'CHUNK_PLAYBACK',
                            payload: {
                                vocals: safeVocals,
                                instrumentals: safeInstr,
                                position: globalWritePosition
                            }
                        }, [safeVocals.buffer, safeInstr.buffer]);

                        globalWritePosition += safeLen;

                        // Save tails
                        vocalsTail = vocals.slice(safeLen);
                        instrumentalsTail = instrumentals.slice(safeLen);
                    } else {
                        // Merge with previous tail
                        if (vocalsTail && instrumentalsTail) {
                            applyCrossfade(vocals, vocalsTail, 0, crossfadeFrames, channels);
                            applyCrossfade(instrumentals, instrumentalsTail, 0, crossfadeFrames, channels);
                        }

                        const isLast = index === segments.length - 1;
                        const safeLen = isLast ? vocals.length : vocals.length - crossfadeFrames;

                        const safeVocals = vocals.slice(0, safeLen);
                        const safeInstr = instrumentals.slice(0, safeLen);

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (self as any).postMessage({
                            type: 'CHUNK_PLAYBACK',
                            payload: {
                                vocals: safeVocals,
                                instrumentals: safeInstr,
                                position: globalWritePosition
                            }
                        }, [safeVocals.buffer, safeInstr.buffer]);

                        globalWritePosition += safeLen;

                        if (!isLast) {
                            vocalsTail = vocals.slice(safeLen);
                            instrumentalsTail = instrumentals.slice(safeLen);
                        }
                    }
                },
                abortController.signal
            );

            // Phase 6: Complete
            // We do NOT cache here to save memory. 
            // The main thread can cache if it accumulated the chunks.

            sendProgress({ phase: 'caching', currentSegment: totalSegments, totalSegments, percentage: 100, message: 'Complete!' });

            engine.dispose();

            // Send empty buffers as complete signal
            self.postMessage({
                type: 'COMPLETE',
                payload: {
                    vocals: new ArrayBuffer(0),
                    instrumentals: new ArrayBuffer(0),
                    fileHash,
                    timestamp: Date.now()
                }
            });

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

self.onerror = (error) => {
    console.error('[audio.worker] Worker error event:', error);
};
