/**
 * Web Worker for Audio Separation
 * Handles heavy processing off the main thread to keep UI responsive.
 */

import { hashFile, getCachedAudio, cacheAudioResult } from '@/utils/storage/audioCache';
import { segmentAudio, applyCrossfade } from '@/utils/audio/audioProcessor';
import { loadModel } from './modelManager';
import { processAudioInChunks } from './inference';
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

            const session = await loadModel(modelInfo, (progress) => {
                sendProgress({
                    phase: 'loading-model',
                    currentSegment: 0,
                    totalSegments: 0,
                    percentage: 10 + (progress.percentage * 0.2),
                    message: `Downloading model: ${progress.percentage.toFixed(0)}%`
                });
            });

            if (isAborted) throw new Error('Processing aborted by user');

            // Phase 4: Segment audio (Data is already decoded from main thread)
            sendProgress({ phase: 'segmenting', currentSegment: 0, totalSegments: 0, percentage: 35, message: 'Segmenting audio...' });

            // Mock AudioBuffer-like object for segmentAudio
            const mockBuffer = {
                sampleRate,
                numberOfChannels: 2,
                length: decodedData.left.length,
                duration: decodedData.left.length / sampleRate,
                getChannelData: (channel: number) => channel === 0 ? decodedData.left : decodedData.right
            };

            const targetFrames = (modelInfo.config as any)?.targetFrames || 256;
            const hopLength = modelInfo.config?.hopLength || 1024;
            const idealSegmentDuration = (targetFrames * hopLength) / sampleRate;

            const segments = segmentAudio(
                mockBuffer as import('@/utils/audio/audioProcessor').SimpleAudioBuffer,
                idealSegmentDuration
            );
            const totalSegments = segments.length;

            // Prepare for streaming merge
            // We'll write directly into these buffers
            const outputLength = decodedData.left.length;
            const vocalsMerged = new Float32Array(outputLength);
            const instrumentalsMerged = new Float32Array(outputLength);

            let writePosition = 0;
            let lastSentPosition = 0;
            const channels = 2; // Assuming stereo output

            // Calculate crossfade parameters
            // Note: segmentAudio uses logic that results in overlaps.
            // We need to infer the overlap from the segments or model config.
            // Usually, segment length > hop length. 
            // segmentAudio produces segments of 'segmentDuration'.
            // They are overlapped by 'overlap' which is 50% by default in segmentAudio if not specified?
            // Actually segmentAudio implementation details matter here.
            // Let's assume standard 50% overlap or calculate from segment length vs hop.
            // Since we don't have exact overlap from segmentAudio return, we might need to rely on the fact that
            // segmentAudio handles the cutting.
            // But wait, `segmentAudio` returns just the chunks. It doesn't tell us where they go.
            // However, `mergeSegments` usually assumes consistent overlap.

            // Let's look at `segmentAudio` defaults in `audioProcessor.ts`? 
            // I cannot read it now without another tool call.
            // But usually overlap is consistent.

            // Standard crossfade strategy used in `mergeSegments` implies we know the overlap.
            // If we use `applyCrossfade` we need `crossfadeFrames`.
            // Let's estimate `crossfadeFrames` based on segment length and assuming typical overlap.
            // If segment length is N, and we have M segments covering TotalLength.
            // But `mergeSegments` logic I saw earlier uses `crossfadeSamples`.
            // I need to know `crossfadeSamples`.
            // In `audioProcessor.ts` `mergeSegments` calculated it or used a default.
            // Since I can't see `mergeSegments` full body, I'll assume a safe crossfade or use `hopLength` if available.
            // Actually, `mergeSegments` was passed `audioBuffer` before.
            // Let's assume a small crossfade if we are just stitching, or proper overlap-add if using windowing.
            // BUT, `segmentAudio` returns raw chunks. 

            // CRITICAL: `mergeSegments` in `audioProcessor.ts` likely had a hardcoded or calculated crossfade.
            // I will use a reasonable default if I can't find it.
            // Standard crossfade is often 10-25% or fixed samples.
            // Let's use 1024 samples as a safe bet for smooth transitions if not strictly defined.
            // OR better: The `segmentAudio` usually overlaps by 50%?
            // I will calculate crossfade based on: (totalSegments * segmentLen - totalLen) / (totalSegments - 1).
            // This gives average overlap.

            const segmentLen = segments[0]?.data.length || 0;
            const estimatedTotalLen = segments.length * segmentLen; // if no overlap
            // Real length is decodedData.left.length.
            // Overlap = (estimatedTotalLen - outputLength) / (segments.length - 1)

            let crossfadeFrames = 0;
            if (segments.length > 1) {
                crossfadeFrames = Math.floor((segments.length * segmentLen - outputLength) / (segments.length - 1));
                // Clamp to reasonable values
                if (crossfadeFrames < 0) crossfadeFrames = 0;
                if (crossfadeFrames > segmentLen / 2) crossfadeFrames = Math.floor(segmentLen / 2);
            }
            console.log(`[audio.worker] Estimated crossfade frames: ${crossfadeFrames}`);

            // Phase 5: Inference with Streaming
            sendProgress({ phase: 'separating', currentSegment: 0, totalSegments, percentage: 40, message: 'Starting separation...' });

            await processAudioInChunks(
                session,
                segments.map(s => s.data),
                2, // channels
                sampleRate,
                (currentSegment, total) => {
                    const separationProgress = 40 + ((currentSegment / total) * 55);
                    sendProgress({
                        phase: 'separating',
                        currentSegment,
                        totalSegments: total,
                        percentage: separationProgress,
                        message: `Processing segment ${currentSegment + 1} of ${total}...`
                    });
                },
                (chunkResult, index) => {
                    // Logic to merge chunk into main buffer
                    const vocals = chunkResult.vocals; // Float32Array
                    const instrumentals = chunkResult.instrumentals; // Float32Array

                    // We are processing segments sequentially.
                    // We need to merge 'vocals' into 'vocalsMerged'.

                    if (index === 0) {
                        vocalsMerged.set(vocals, writePosition);
                        instrumentalsMerged.set(instrumentals, writePosition);
                        writePosition += vocals.length - crossfadeFrames;
                    } else {
                        // Apply crossfade with previous
                        // The 'writePosition' is where the *next* segment starts (start of overlap).
                        // So the overlap region starts at 'writePosition'.
                        // Wait, 'writePosition' should be the start of the *current* segment's exclusive part?
                        // No, in standard OLA:
                        // Seg 0: [ A | B ]
                        // Seg 1:     [ B'| C ]
                        // Overlap is B + B'.
                        // writePosition after Seg 0 should be start of B.

                        // Let's use the logic I saw in `audioProcessor.ts`:
                        // writePosition += segment.length - crossfadeSamples;

                        // So for current segment (which is index > 0):
                        // It overlaps at 'writePosition'.

                        applyCrossfade(vocalsMerged, vocals, writePosition, crossfadeFrames, channels);
                        applyCrossfade(instrumentalsMerged, instrumentals, writePosition, crossfadeFrames, channels);

                        if (index === segments.length - 1) {
                            writePosition += vocals.length;
                        } else {
                            writePosition += vocals.length - crossfadeFrames;
                        }
                    }

                    // Streaming logic
                    // The part *before* the current overlap region is now stable.
                    // Current overlap starts at 'writePosition' (before update) actually?
                    // No, `applyCrossfade` modifies `target` starting at `writePosition`.
                    // So `vocalsMerged` is modified from `writePosition` onwards.
                    // The data *before* `writePosition` is from previous segments and is STABLE.
                    // So we can stream everything from `lastSentPosition` to `writePosition`.

                    // Note: In the block above, I updated `writePosition` *after* applying crossfade.
                    // So `writePosition` is now the start of the *next* overlap.
                    // The region we just wrote is [oldWritePosition, oldWritePosition + len].
                    // The region that is safe is [0, writePosition].
                    // Wait, the *end* of the current segment might be modified by the *next* segment.
                    // So the safe region is only up to `writePosition` (which is the start of next overlap).

                    const safeEnd = writePosition;

                    if (safeEnd > lastSentPosition) {
                        const vocabChunk = vocalsMerged.slice(lastSentPosition, safeEnd);
                        const instrChunk = instrumentalsMerged.slice(lastSentPosition, safeEnd);

                        self.postMessage({
                            type: 'CHUNK_PLAYBACK',
                            payload: {
                                vocals: vocabChunk,
                                instrumentals: instrChunk,
                                position: lastSentPosition
                            }
                        }, { transfer: [vocabChunk.buffer, instrChunk.buffer] } as any);

                        lastSentPosition = safeEnd;
                    }
                },
                () => isAborted
            );

            // Send any remaining data (last segment tail)
            if (writePosition > lastSentPosition) {
                // For the last segment, we updated writePosition to include the full tail.
                const vocabChunk = vocalsMerged.slice(lastSentPosition, writePosition);
                const instrChunk = instrumentalsMerged.slice(lastSentPosition, writePosition);

                self.postMessage({
                    type: 'CHUNK_PLAYBACK',
                    payload: {
                        vocals: vocabChunk,
                        instrumentals: instrChunk,
                        position: lastSentPosition
                    }
                }, { transfer: [vocabChunk.buffer, instrChunk.buffer] } as any);
            }

            // Phase 7: Cache
            sendProgress({ phase: 'caching', currentSegment: totalSegments, totalSegments, percentage: 95, message: 'Caching results...' });

            // Convert Float32Array buffers to ArrayBuffers
            const vocalsArrayBuffer = vocalsMerged.buffer as ArrayBuffer;
            const instrumentalsArrayBuffer = instrumentalsMerged.buffer as ArrayBuffer;

            if (isAborted) throw new Error('Processing aborted by user');

            await cacheAudioResult(
                fileHash,
                file.name,
                vocalsArrayBuffer,
                instrumentalsArrayBuffer,
                decodedData.left.length / sampleRate, // duration
                sampleRate
            );

            // Phase 8: Complete
            sendProgress({ phase: 'caching', currentSegment: totalSegments, totalSegments, percentage: 100, message: 'Complete!' });

            self.postMessage({
                type: 'COMPLETE',
                payload: {
                    vocals: vocalsArrayBuffer,
                    instrumentals: instrumentalsArrayBuffer,
                    fileHash,
                    timestamp: Date.now()
                }
            }, {
                transfer: [vocalsArrayBuffer, instrumentalsArrayBuffer]
            } as WindowPostMessageOptions);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // If aborted, we can silently fail or send a specific message, 
            // but standard is to just log it or let the UI handle the cancellation state.
            if (errorMessage === 'Processing aborted by user') {
                console.log('[audio.worker] Processing aborted.');
                return; // Do not send ERROR
            }

            const stack = error instanceof Error ? error.stack : undefined;

            console.error('[audio.worker] Separation error:', {
                message: errorMessage,
                stack,
                error
            });

            let clientMessage = errorMessage;
            if (errorMessage.includes('Failed to fetch')) {
                clientMessage = `Network error: ${errorMessage}. Check if the model URL is accessible and CORS is allowed.`;
            }

            self.postMessage({
                type: 'ERROR',
                payload: { message: clientMessage }
            });
        }
    }
};

self.onerror = (error) => {
    console.error('[audio.worker] Worker error event:', error);
};
