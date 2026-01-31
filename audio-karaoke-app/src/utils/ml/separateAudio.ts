import { decodeAudioFile, float32ArrayToAudioBuffer } from '@/utils/audio/audioDecoder';
import { resampleAudio } from '@/utils/audio/audioProcessor';
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
 * Separate audio into vocals and instrumentals
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

        const cleanup = () => {
            if (signal) {
                signal.removeEventListener('abort', handleAbort);
            }
            if (worker) {
                worker.terminate();
                worker = null;
            }
        };

        const handleAbort = () => {
            console.log('[separateAudio] Abort signal received');
            if (worker) {
                worker.postMessage({ type: 'ABORT' });
                // Give worker a moment to clean up if needed, or terminate immediately
                // For safety and immediate resource release:
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
            // Phase 4 (Pre-Worker): Decode Audio
            // We do this in main thread because we have AudioContext
            updateProgress(onProgress, 'decoding', 0, 0, 0, 'Decoding audio file...');

            // Check abort before heavy operation
            if (signal?.aborted) throw new Error('Processing aborted by user');

            const decodedBuffer = await decodeAudioFile(file);

            if (signal?.aborted) throw new Error('Processing aborted by user');

            // Resample if model requires a different sample rate
            let processingBuffer = decodedBuffer;
            const targetSampleRate = modelInfo.config?.sampleRate;

            if (targetSampleRate && targetSampleRate !== decodedBuffer.sampleRate) {
                console.log(`[separateAudio] Resampling from ${decodedBuffer.sampleRate} to ${targetSampleRate}`);
                updateProgress(onProgress, 'decoding', 0, 0, 0, `Resampling audio to ${targetSampleRate}Hz...`);
                processingBuffer = await resampleAudio(decodedBuffer, targetSampleRate);
            }

            if (signal?.aborted) throw new Error('Processing aborted by user');

            // Prepare data for worker
            // Ensure we handle stereo correctly without downmixing
            const channel1 = processingBuffer.getChannelData(0);
            const channel2 = processingBuffer.numberOfChannels > 1 ? processingBuffer.getChannelData(1) : channel1;

            const left = new Float32Array(channel1);
            const right = new Float32Array(channel2);

            console.log('[separateAudio] Creating worker...');
            worker = new Worker(new URL('./audio.worker.ts', import.meta.url));
            console.log('[separateAudio] Worker created successfully');

            worker.onmessage = (e) => {
                const { type, payload } = e.data;
                // console.log('[separateAudio] Worker message received:', type);

                if (type === 'PROGRESS') {
                    if (onProgress) onProgress(payload);
                } else if (type === 'CHUNK_PLAYBACK') {
                    if (onChunk) {
                        onChunk({
                            vocals: payload.vocals,
                            instrumentals: payload.instrumentals,
                            position: payload.position,
                            sampleRate: processingBuffer.sampleRate
                        });
                    }
                } else if (type === 'COMPLETE') {
                    const { vocals, instrumentals, fileHash, timestamp } = payload;
                    console.log('[separateAudio] Worker completed successfully');

                    // Convert ArrayBuffers back to AudioBuffers
                    // Use processingBuffer.sampleRate as the result is at that rate
                    Promise.all([
                        arrayBufferToAudioBuffer(vocals, processingBuffer.sampleRate),
                        arrayBufferToAudioBuffer(instrumentals, processingBuffer.sampleRate)
                    ]).then(([vocalsBuffer, instrumentalsBuffer]) => {
                        cleanup();
                        resolve({
                            vocals: vocalsBuffer,
                            instrumentals: instrumentalsBuffer,
                            originalAudio: decodedBuffer, // Return original for reference/playback if needed
                            timestamp,
                            fileHash
                        });
                    }).catch(err => {
                        console.error('[separateAudio] Error converting buffers:', err);
                        cleanup();
                        reject(err);
                    });
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
