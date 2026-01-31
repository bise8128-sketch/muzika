import { decodeAudioFile } from '@/utils/audio/audioDecoder';
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

        // Use model sample rate or default to 44100
        const sampleRate = modelInfo.config?.sampleRate || 44100;

        const bufferManager = new StreamableBufferManager(
            sampleRate,
            2 // Assuming stereo output from models
        );

        const cleanup = () => {
            if (signal) {
                signal.removeEventListener('abort', handleAbort);
            }
            if (worker) {
                worker.terminate();
                worker = null;
            }
            bufferManager.clear();
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
                    // payload.vocals and instrumentals are Float32Array
                    bufferManager.addChunk(payload.vocals, payload.instrumentals);

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
                        if (payload.vocals && payload.vocals.byteLength > 0) {
                            console.log('[separateAudio] Ingesting full result from worker/cache');
                            const vFloat = new Float32Array(payload.vocals);
                            const iFloat = new Float32Array(payload.instrumentals);
                            bufferManager.addChunk(vFloat, iFloat);
                        } else {
                            console.log('[separateAudio] Finalizing from streamed chunks');
                        }

                        // Get AudioContext to create final buffers
                        let ctx: AudioContext;
                        try {
                            ctx = getAudioContext();
                        } catch (e) {
                            // Fallback if getAudioContext fails or isn't initialized
                            ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
                                sampleRate: sampleRate
                            });
                        }

                        // Reconstruct final AudioBuffers
                        const buffers = bufferManager.getAllAudioBuffers(ctx);

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
                    }
                } else if (type === 'ERROR') {
                    console.error('[separateAudio] Worker error:', payload.message);
                    cleanup();
                    reject(new Error(payload.message));
                }
            };

            worker.onerror = (e) => {
                console.error('[separateAudio] Worker error:', e);
                cleanup();
                reject(new Error('Worker error'));
            };

            // Start processing with TRANSFERABLE buffers to save memory
            // This moves the data ownership to the worker
            worker.postMessage({
                type: 'START_SEPARATION',
                payload: {
                    file, // File object is cloned
                    decodedData: { left, right },
                    sampleRate: processingBuffer.sampleRate,
                    modelInfo,
                    skipCache
                }
            }, [left.buffer, right.buffer]);

        } catch (error) {
            console.error('[separateAudio] Error:', error);
            cleanup();
            reject(error);
        }
    });
}

function updateProgress(
    callback: ((progress: ProcessingProgress) => void) | undefined,
    phase: ProcessingProgress['phase'],
    current: number,
    total: number,
    percentage: number,
    message: string
) {
    if (callback) {
        callback({ phase, currentSegment: current, totalSegments: total, percentage, message });
    }
}
