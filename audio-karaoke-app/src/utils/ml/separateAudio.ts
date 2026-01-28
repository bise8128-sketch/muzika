import { decodeAudioFile, float32ArrayToAudioBuffer } from '@/utils/audio/audioDecoder';
import type { ModelInfo } from '@/types/model';
import type { SeparationResult, ProcessingProgress } from '@/types/audio';

export interface SeparationOptions {
    modelInfo: ModelInfo;
    onProgress?: (progress: ProcessingProgress) => void;
    skipCache?: boolean;
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
    const { modelInfo, onProgress, skipCache = false } = options;

    return new Promise(async (resolve, reject) => {
        try {
            // Check cache first in main thread to avoid worker overhead if possible?
            // Actually, we moved cache check to worker. But we CAN check hash here if we want.
            // Let's stick to the plan: Worker does it all.

            // Phase 4 (Pre-Worker): Decode Audio
            // We do this in main thread because we have AudioContext
            updateProgress(onProgress, 'decoding', 0, 0, 0, 'Decoding audio file...');
            const audioBuffer = await decodeAudioFile(file);

            // Prepare data for worker
            // We need to pass raw data. 
            // Current model works in Mono (based on segmentAudio impl).
            // But we should pass Stereo just in case we upgrade later.
            const channel1 = audioBuffer.getChannelData(0);
            const channel2 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : channel1;

            // Transfer these buffers to worker
            // Note: getChannelData returns the internal buffer reference in some browsers, copy in others.
            // Using a copy ensures we don't detach the AudioBuffer's data if we want to keep playing it.
            // But here we return 'originalAudio', so we might need it.
            // Safe bet: copy.
            const left = new Float32Array(channel1);
            const right = new Float32Array(channel2);

            const worker = new Worker(new URL('./audio.worker.ts', import.meta.url));

            worker.onmessage = (e) => {
                const { type, payload } = e.data;

                if (type === 'PROGRESS') {
                    if (onProgress) onProgress(payload);
                } else if (type === 'COMPLETE') {
                    const { vocals, instrumentals, fileHash, timestamp } = payload;

                    // Convert ArrayBuffers back to AudioBuffers
                    Promise.all([
                        arrayBufferToAudioBuffer(vocals, audioBuffer.sampleRate),
                        arrayBufferToAudioBuffer(instrumentals, audioBuffer.sampleRate)
                    ]).then(([vocalsBuffer, instrumentalsBuffer]) => {
                        worker.terminate();
                        resolve({
                            vocals: vocalsBuffer,
                            instrumentals: instrumentalsBuffer,
                            originalAudio: audioBuffer,
                            timestamp,
                            fileHash
                        });
                    }).catch(err => {
                        worker.terminate();
                        reject(err);
                    });
                } else if (type === 'ERROR') {
                    worker.terminate();
                    reject(new Error(payload.message));
                }
            };

            worker.postMessage({
                type: 'START_SEPARATION',
                payload: {
                    file, // File objects are clonable
                    decodedData: { left, right },
                    sampleRate: audioBuffer.sampleRate,
                    modelInfo,
                    skipCache
                }
            }, [left.buffer, right.buffer]); // Transfer buffers

        } catch (error) {
            console.error('Separation failed:', error);
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


