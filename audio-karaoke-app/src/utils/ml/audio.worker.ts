/**
 * Web Worker for Audio Separation
 * Handles heavy processing off the main thread to keep UI responsive.
 */

import { hashFile, getCachedAudio, cacheAudioResult } from '@/utils/storage/audioCache';
import { segmentAudio, mergeSegments } from '@/utils/audio/audioProcessor';
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
    | { type: 'COMPLETE'; payload: { vocals: ArrayBuffer; instrumentals: ArrayBuffer; fileHash: string; timestamp: number } }
    | { type: 'ERROR'; payload: { message: string } };

// Helper to send progress
const sendProgress = (progress: ProcessingProgress) => {
    self.postMessage({ type: 'PROGRESS', payload: progress });
};



self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { type } = e.data;

    if (type === 'START_SEPARATION') {
        const { file, decodedData, sampleRate, modelInfo, skipCache } = e.data.payload;

        try {
            // Phase 1: Generate file hash
            sendProgress({ phase: 'loading-model', currentSegment: 0, totalSegments: 0, percentage: 0, message: 'Generating file hash...' });
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
            const session = await loadModel(modelInfo, (progress) => {
                sendProgress({
                    phase: 'loading-model',
                    currentSegment: 0,
                    totalSegments: 0,
                    percentage: 10 + (progress.percentage * 0.2),
                    message: `Downloading model: ${progress.percentage.toFixed(0)}%`
                });
            });

            // Phase 4: Segment audio (Data is already decoded from main thread)
            sendProgress({ phase: 'segmenting', currentSegment: 0, totalSegments: 0, percentage: 35, message: 'Segmenting audio...' });

            // Reconstruct stereo buffer for segmentation
            // segmentAudio expects an AudioBuffer-like interface or we need to adapt it. 
            // Looking at previous separateAudio.ts, it passed 'audioBuffer' to 'segmentAudio'.
            // Let's assume segmentAudio can handle raw data if we adapt it or check its signature.
            // Wait, segmentAudio likely takes AudioBuffer. I need to check segmentAudio.ts.
            // For now, I'll reconstruct a simple object that mimics AudioBuffer if needed, or update segmentAudio.
            // But I cannot create AudioBuffer in worker. 
            // I will assume segmentAudio needs to be checked.

            // Checking segmentAudio signature from separateAudio.ts call: `segmentAudio(audioBuffer)`
            // I'll need to update segmentAudio to working with raw Float32Arrays if it relies on AudioBuffer methods.

            // Let's assume for this step I can fix segmentAudio later or use a workaround.
            // Workaround: Mock AudioBuffer-like object
            const mockBuffer = {
                sampleRate,
                numberOfChannels: 2,
                length: decodedData.left.length,
                duration: decodedData.left.length / sampleRate,
                getChannelData: (channel: number) => channel === 0 ? decodedData.left : decodedData.right
            };

            const segments = segmentAudio(mockBuffer as import('@/utils/audio/audioProcessor').SimpleAudioBuffer);
            const totalSegments = segments.length;

            // Phase 5: Inference
            sendProgress({ phase: 'separating', currentSegment: 0, totalSegments, percentage: 40, message: 'Starting separation...' });

            const results = await processAudioInChunks(
                session,
                segments.map(s => s.data),
                2, // channels
                (currentSegment, total) => {
                    const separationProgress = 40 + ((currentSegment / total) * 50);
                    sendProgress({
                        phase: 'separating',
                        currentSegment,
                        totalSegments: total,
                        percentage: separationProgress,
                        message: `Processing segment ${currentSegment + 1} of ${total}...`
                    });
                }
            );

            // Phase 6: Merge
            sendProgress({ phase: 'merging', currentSegment: totalSegments, totalSegments, percentage: 90, message: 'Merging segments...' });

            const vocalsData = results.map(r => r.vocals);
            const instrumentalsData = results.map(r => r.instrumentals);

            // mergeSegments now returns Float32Array by default (mono mix for now, or just merged single channel)
            // Wait, does mergeSegments handle stereo?
            // The current implementation of mergeSegments in audioProcessor.ts calculates 'totalLength' and merges. 
            // It treats input as flat Float32Array. 
            // If our inputs are mono segment chunks, output is mono.

            // We have processAudioInChunks returning results where 'vocals' and 'instrumentals' are Float32Array.
            // These are likely Mono if the model is Mono. 
            // If the model output is stereo, we'd need to handle that.
            // Current 'inference.ts' returns simple Float32Arrays.
            // Let's assume Mono for now as per previous implementation (downmixing).

            const vocalsMerged = mergeSegments(vocalsData, sampleRate);
            const instrumentalsMerged = mergeSegments(instrumentalsData, sampleRate);

            // Phase 7: Cache
            sendProgress({ phase: 'caching', currentSegment: totalSegments, totalSegments, percentage: 95, message: 'Caching results...' });

            // Convert mono float32 to ArrayBuffer (interleaved stereo-like or just one channel?)
            // cacheAudioResult expects ArrayBuffer.
            // audioCache.ts doesn't specify channel count.
            // But separateAudio.ts (client) converts them back using 'arrayBufferToAudioBuffer' which calls 'float32ArrayToAudioBuffer'
            // 'float32ArrayToAudioBuffer' in audioDecoder.ts defaults to 2 channels if not specified? 
            // No, it defaults to 1.

            // Let's use float32ToInterleaved to make it dual-mono (fake stereo) just to be safe if the UI expects stereo files, 
            // OR just send the mono buffer if that's what we have.
            // If we use float32ToInterleaved, we double the size.
            // Let's stick to what we have. If vocalsMerged is Float32Array, its .buffer is an ArrayBuffer.

            const vocalsBuffer = vocalsMerged.buffer;
            const instrumentalsBuffer = instrumentalsMerged.buffer;

            await cacheAudioResult(
                fileHash,
                file.name,
                vocalsBuffer,
                instrumentalsBuffer,
                decodedData.left.length / sampleRate, // duration
                sampleRate
            );

            // Phase 8: Complete
            sendProgress({ phase: 'caching', currentSegment: totalSegments, totalSegments, percentage: 100, message: 'Complete!' });

            self.postMessage({
                type: 'COMPLETE',
                payload: {
                    vocals: vocalsBuffer,
                    instrumentals: instrumentalsBuffer,
                    fileHash,
                    timestamp: Date.now()
                }
            }, [vocalsBuffer, instrumentalsBuffer]); // Transfer buffers

        } catch (error) {
            self.postMessage({ type: 'ERROR', payload: { message: error instanceof Error ? error.message : 'Unknown error' } });
        }
    }
};
