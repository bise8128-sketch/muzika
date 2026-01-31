import { decodeAudioFile, float32ArrayToAudioBuffer } from '@/utils/audio/audioDecoder';
import { resampleAudio } from '@/utils/audio/audioProcessor';
import { StreamableBufferManager } from '@/utils/audio/StreamableBufferManager';
import { getAudioContext } from '@/utils/audio/audioContext';
import type { ModelInfo } from '@/types/model';
import type { SeparationResult, ProcessingProgress } from '@/types/audio';

export interface SeparationOptions {
    modelInfo: ModelInfo;
    onProgress?: (progress: ProcessingProgress) => void;
    onChunk?: (chunk: { vocals: Float32Array; instrumentals: Float32Array; position: number; sampleRate: number }) => void;
    skipCache?: boolean;
    signal?: AbortSignal;
}

/**
 * Separate audio into vocals and instrumentals using a Web Worker.
 * Supports progressive streaming and WebGPU acceleration.
 *
 * @param file - Audio file to process
 * @param options - Separation options including model info and callbacks
 * @returns Separation result with vocals and instrumentals AudioBuffers
 */
export async function separateAudio(
    file: File,
    options: SeparationOptions
): Promise<SeparationResult> {
    const { modelInfo, onProgress, onChunk, skipCache = false, signal } = options;

    return new Promise(async (resolve, reject) => {
        let worker: Worker | null = null;
        let bufferManager: StreamableBufferManager | null = null;

        // Use model sample rate or default to 44100
        const sampleRate = modelInfo.config?.sampleRate || 44100;

        try {
            // Initialize buffer manager with context
            const ctx = getAudioContext();
            bufferManager = new StreamableBufferManager(ctx);
        } catch (e) {
            console.warn('[separateAudio] Could not initialize StreamableBufferManager with AudioContext:', e);
            // We might proceed without buffer manager if we only want separation, 
            // but the architecture relies on it for reconstruction.
            // If AudioContext fails, likely everything fails.
            reject(e);
            return;
        }

        const cleanup = () => {
            if (signal) {
                signal.removeEventListener('abort', handleAbort);
            }
            if (worker) {
                worker.terminate();
                worker = null;
            }
            if (bufferManager) {
                bufferManager.reset();
            }
        };

        const handleAbort = () => {
            console.log('[separateAudio] Abort signal received');
            if (worker) {
                worker.postMessage({ type: 'ABORT' });
                worker.terminate();
                worker = null;
            }
            reject(new Error('Processing aborted by user'));
        };

        if (signal) {
            if (signal.aborted) {
                return reject(new Error('Processing aborted by user'));
            }
            signal.addEventListener('abort', handleAbort);
        }

        try {
            // Phase 1: Decode Audio (Main Thread)
            updateProgress(onProgress, 'decoding', 0, 0, 0, 'Decoding audio file...');

            if (signal?.aborted) throw new Error('Processing aborted by user');

            const decodedBuffer = await decodeAudioFile(file);

            if (signal?.aborted) throw new Error('Processing aborted by user');

            // Phase 2: Resample if needed
            let processingBuffer = decodedBuffer;

            if (sampleRate && sampleRate !== decodedBuffer.sampleRate) {
                console.log(`[separateAudio] Resampling from ${decodedBuffer.sampleRate} to ${sampleRate}`);
                updateProgress(onProgress, 'decoding', 0, 0, 0, `Resampling audio to ${sampleRate}Hz...`);
                processingBuffer = await resampleAudio(decodedBuffer, sampleRate);
            }

            if (signal?.aborted) throw new Error('Processing aborted by user');

            // Phase 3: Prepare data for worker
            // Extract channels
            const channel1 = processingBuffer.getChannelData(0);
            const channel2 = processingBuffer.numberOfChannels > 1 ? processingBuffer.getChannelData(1) : channel1;

            // Clone data to Float32Arrays that we can transfer ownership of
            const left = new Float32Array(channel1);
            const right = new Float32Array(channel2);

            console.log('[separateAudio] Creating worker...');
            worker = new Worker(new URL('./audio.worker.ts', import.meta.url));
            console.log('[separateAudio] Worker created successfully');

            worker.onmessage = (e) => {
                const { type, payload } = e.data;

                if (type === 'PROGRESS') {
                    if (onProgress) onProgress(payload);
                } else if (type === 'CHUNK_PLAYBACK') {
                    // Accumulate streaming chunks
                    if (bufferManager) {
                        bufferManager.addChunk(
                            payload.vocals,
                            payload.instrumentals
                        );
                        // Enable immediate playback as chunks arrive
                        bufferManager.play();
                    }

                    if (onChunk) {
                        onChunk({
                            ...payload,
                            sampleRate: processingBuffer.sampleRate
                        });
                    }
                } else if (type === 'COMPLETE') {
                    console.log('[separateAudio] Worker completed separation');

                    try {
                        // If the worker returned full buffers (e.g. from cache), ingest them into manager
                        // payload.vocals is ArrayBuffer (raw bytes of Float32Array)
                        if (payload.vocals && payload.vocals.byteLength > 0 && bufferManager) {
                            console.log('[separateAudio] Ingesting full result from worker/cache');
                            const vFloat = new Float32Array(payload.vocals);
                            const iFloat = new Float32Array(payload.instrumentals);
                            // For full file, position is 0
                            bufferManager.addChunk(vFloat, iFloat);
                        } else {
                            console.log('[separateAudio] Finalizing from streamed chunks');
                        }

                        // Reconstruct final AudioBuffers
                        if (!bufferManager) throw new Error('BufferManager not initialized');

                        const buffers = bufferManager.getAllAudioBuffers();

                        resolve({
                            vocals: buffers.vocals,
                            instrumentals: buffers.instrumentals,
                            originalAudio: processingBuffer,
                            fileHash: payload.fileHash,
                            timestamp: payload.timestamp
                        });
                    } catch (err) {
                        reject(new Error('Failed to reconstruct audio buffers: ' + (err as Error).message));
                    } finally {
                        worker?.terminate();
                        worker = null;
                        if (signal) {
                            signal.removeEventListener('abort', handleAbort);
                        }
                    }
                } else if (type === 'ERROR') {
                    console.error('[separateAudio] Worker error:', payload.message);
                    cleanup();
                    reject(new Error(payload.message));
                }
            };

            worker.onerror = (error) => {
                console.error('[separateAudio] Worker error event:', error);
                cleanup();
                reject(new Error(`Worker error: ${error.message}`));
            };

            // Ensure absolute URL for worker
            const absoluteModelInfo = {
                ...modelInfo,
                url: modelInfo.url ? (modelInfo.url.startsWith('http')
                    ? modelInfo.url
                    : `${window.location.origin}${modelInfo.url}`) : ''
            };

            worker.postMessage({
                type: 'START_SEPARATION',
                payload: {
                    file, // File objects are clonable
                    decodedData: { left, right },
                    sampleRate: processingBuffer.sampleRate,
                    modelInfo: absoluteModelInfo,
                    skipCache
                }
            }, [left.buffer, right.buffer]); // Transfer buffers

        } catch (error) {
            console.error('Separation failed:', error);
            cleanup();
            reject(new Error(`Audio separation failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    });
}

/**
 * Helper to update progress callback
 */
function updateProgress(
    callback: ((progress: ProcessingProgress) => void) | undefined,
    phase: ProcessingProgress['phase'],
    currentSegment: number,
    totalSegments: number,
    percentage: number,
    message?: string
): void {
    if (callback) {
        callback({
            phase,
            currentSegment,
            totalSegments,
            percentage: Math.min(100, Math.max(0, percentage)),
            message,
        });
    }
}

/**
 * Convert ArrayBuffer to AudioBuffer
 */
async function arrayBufferToAudioBuffer(
    arrayBuffer: ArrayBuffer,
    sampleRate: number
): Promise<AudioBuffer> {
    // Convert ArrayBuffer back to Float32Array
    const float32Data = new Float32Array(arrayBuffer);
    return float32ArrayToAudioBuffer(float32Data, sampleRate, 2); // Assume stereo
}
