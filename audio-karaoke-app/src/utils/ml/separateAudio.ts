/**
 * Main Audio Separation Pipeline
 * Orchestrates the complete separation process with caching and progress tracking
 */

import { hashFile, getCachedAudio, cacheAudioResult } from '@/utils/storage/audioCache';
import { decodeAudioFile, float32ArrayToAudioBuffer } from '@/utils/audio/audioDecoder';
import { segmentAudio, mergeSegments } from '@/utils/audio/audioProcessor';
import { loadModel } from './modelManager';
import { processAudioInChunks } from './inference';
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

    try {
        // Phase 1: Generate file hash for cache lookup
        updateProgress(onProgress, 'loading-model', 0, 0, 0, 'Generating file hash...');
        const fileHash = await hashFile(file);

        // Phase 2: Check cache (unless explicitly skipped)
        if (!skipCache) {
            updateProgress(onProgress, 'loading-model', 0, 0, 5, 'Checking cache...');
            const cached = await getCachedAudio(fileHash);

            if (cached) {
                updateProgress(onProgress, 'loading-model', 0, 0, 100, 'Loading from cache...');

                // Convert cached ArrayBuffers back to AudioBuffers
                const vocalsBuffer = await arrayBufferToAudioBuffer(cached.vocals, cached.sampleRate);
                const instrumentalsBuffer = await arrayBufferToAudioBuffer(cached.instrumentals, cached.sampleRate);
                const originalBuffer = await decodeAudioFile(file);

                return {
                    vocals: vocalsBuffer,
                    instrumentals: instrumentalsBuffer,
                    originalAudio: originalBuffer,
                    timestamp: cached.processedAt,
                    fileHash,
                };
            }
        }

        // Phase 3: Load model
        updateProgress(onProgress, 'loading-model', 0, 0, 10, 'Loading AI model...');
        const session = await loadModel(modelInfo, (downloadProgress) => {
            // Forward model download progress
            updateProgress(
                onProgress,
                'loading-model',
                0,
                0,
                10 + (downloadProgress.percentage * 0.2), // 10-30%
                `Downloading model: ${downloadProgress.percentage.toFixed(0)}%`
            );
        });

        // Phase 4: Decode audio file
        updateProgress(onProgress, 'decoding', 0, 0, 30, 'Decoding audio file...');
        const audioBuffer = await decodeAudioFile(file);

        // Phase 5: Segment audio into chunks
        updateProgress(onProgress, 'segmenting', 0, 0, 35, 'Segmenting audio...');
        const segments = segmentAudio(audioBuffer);
        const totalSegments = segments.length;

        // Phase 6: Process each segment through inference
        updateProgress(onProgress, 'separating', 0, totalSegments, 40, 'Starting separation...');

        const results = await processAudioInChunks(
            session,
            segments.map(s => s.data),
            audioBuffer.numberOfChannels,
            (currentSegment, total) => {
                const separationProgress = 40 + ((currentSegment / total) * 50); // 40-90%
                updateProgress(
                    onProgress,
                    'separating',
                    currentSegment,
                    total,
                    separationProgress,
                    `Processing segment ${currentSegment + 1} of ${total}...`
                );
            }
        );

        // Phase 7: Merge results with crossfading
        updateProgress(onProgress, 'merging', totalSegments, totalSegments, 90, 'Merging segments...');

        const vocalsData = results.map(r => r.vocals);
        const instrumentalsData = results.map(r => r.instrumentals);

        const vocalsBuffer = mergeSegments(vocalsData, audioBuffer.sampleRate);
        const instrumentalsBuffer = mergeSegments(instrumentalsData, audioBuffer.sampleRate);

        // Phase 8: Cache results
        updateProgress(onProgress, 'caching', totalSegments, totalSegments, 95, 'Caching results...');

        await cacheAudioResult(
            fileHash,
            file.name,
            audioBufferToArrayBuffer(vocalsBuffer),
            audioBufferToArrayBuffer(instrumentalsBuffer),
            audioBuffer.duration,
            audioBuffer.sampleRate
        );

        // Complete
        updateProgress(onProgress, 'caching', totalSegments, totalSegments, 100, 'Complete!');

        return {
            vocals: vocalsBuffer,
            instrumentals: instrumentalsBuffer,
            originalAudio: audioBuffer,
            timestamp: Date.now(),
            fileHash,
        };

    } catch (error) {
        console.error('Separation failed:', error);
        throw new Error(
            `Audio separation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
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

/**
 * Convert AudioBuffer to ArrayBuffer for storage
 */
function audioBufferToArrayBuffer(audioBuffer: AudioBuffer): ArrayBuffer {
    // Interleave channels if stereo
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const interleaved = new Float32Array(length * numberOfChannels);

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            interleaved[i * numberOfChannels + channel] = channelData[i];
        }
    }

    return interleaved.buffer;
}
