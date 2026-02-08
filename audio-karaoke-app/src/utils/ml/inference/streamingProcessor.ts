import { InferenceEngine } from '../inference';
import { InferenceOutput } from '@/types/model';
import { bufferPool } from '../../audio/bufferPool';

export interface StreamingOptions {
    overlap: number; // Overlap in seconds
    minChunkSize: number; // Minimum chunk size in seconds
    maxChunkSize: number; // Maximum chunk size in seconds
    targetLatency: number; // Target processing time per chunk in ms
}

export class StreamingProcessor {
    private engine: InferenceEngine;
    private options: StreamingOptions;
    private currentChunkSize: number; // In seconds

    constructor(engine: InferenceEngine, options: Partial<StreamingOptions> = {}) {
        this.engine = engine;
        this.options = {
            overlap: 2.0, // Default 2s overlap
            minChunkSize: 5.0,
            maxChunkSize: 30.0, // Default start at 30s
            targetLatency: 200, // Target 200ms per chunk processing? No, that's too fast for 30s.
            // Maybe target latency is not per chunk but "time to first byte" or interactivity.
            // Let's assume we want to maximize throughput but keep chunks manageable.
            ...options
        };
        this.currentChunkSize = this.options.maxChunkSize;
    }

    /**
     * Processes audio stream with dynamic chunking and overlap-add.
     */
    async processStream(
        audioData: Float32Array,
        sampleRate: number,
        channels: number,
        onProgress?: (progress: number) => void,
        signal?: AbortSignal
    ): Promise<InferenceOutput> {
        const totalSamples = audioData.length / channels;
        const overlapSamples = Math.floor(this.options.overlap * sampleRate);

        // Output buffers
        const outputLength = audioData.length;
        const vocalsOut = bufferPool.acquire(outputLength);
        const instOut = bufferPool.acquire(outputLength);

        // Initialize with zeros
        vocalsOut.fill(0);
        instOut.fill(0);

        let currentSample = 0;
        let processedSamples = 0;

        while (currentSample < totalSamples) {
            if (signal?.aborted) {
                throw new Error('Processing aborted');
            }

            // Determine chunk size based on remaining samples and current dynamic size
            const chunkSizeSamples = Math.floor(this.currentChunkSize * sampleRate);
            const endSample = Math.min(currentSample + chunkSizeSamples, totalSamples);
            const actualChunkSamples = endSample - currentSample;

            // Extract chunk with overlap if not first chunk
            // Ideally we want [currentSample - overlap, endSample + overlap]
            // But let's simplify: 
            // We advance 'currentSample' by (chunkSize - overlap).
            // So each chunk covers [start, end]. 
            // Next chunk starts at end - overlap.

            // Adjusted logic:
            // We slice from currentSample.
            // We process 'actualChunkSamples'.
            // We advance by 'actualChunkSamples - overlapSamples'.

            if (actualChunkSamples <= 0) break;

            // Extract input chunk
            // Note: audioData is interleaved [L, R, L, R]
            const chunkStart = currentSample * channels;
            const chunkEnd = endSample * channels;
            const chunkData = audioData.slice(chunkStart, chunkEnd); // Copy? Or subarray?
            // Slice creates a copy. Subarray shares memory. 
            // InferenceEngine might modify input? No, typically not.
            // But we need to be careful with buffer reuse if IO binding is used.
            // Let's use slice for safety and simplicity for now.

            const startTime = performance.now();

            // Process chunk
            const result = await this.engine.processChunk(chunkData, channels, sampleRate);

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Dynamic Chunk Size Adjustment
            this.adjustChunkSize(duration, actualChunkSamples / sampleRate);

            // Overlap-Add to output
            // We need to window the edges to avoid clicks?
            // Simple Linear Crossfade in overlap region.

            this.accumulateOutput(vocalsOut, result.vocals, currentSample, channels, overlapSamples, totalSamples);
            this.accumulateOutput(instOut, result.instrumentals, currentSample, channels, overlapSamples, totalSamples);

            // Update progress
            processedSamples += (actualChunkSamples - (currentSample === 0 ? 0 : overlapSamples));
            if (onProgress) onProgress(Math.min(1.0, processedSamples / totalSamples));

            // Advance
            currentSample += (actualChunkSamples - overlapSamples);

            // Safety break
            if (actualChunkSamples < overlapSamples) break;
        }

        return {
            vocals: vocalsOut,
            instrumentals: instOut
        };
    }

    private adjustChunkSize(durationMs: number, chunkDurationSec: number) {
        // Simple logic: If processing is faster than realtime (x factor), maybe increase size?
        // Actually, if it's too slow (latency high), we decrease size to give feedback faster?
        // If we want "real-time streaming", we need processing time < chunk duration.
        // RTF = durationMs / (chunkDurationSec * 1000)
        const rtf = durationMs / (chunkDurationSec * 1000);

        if (rtf > 0.9) {
            // Close to real-time limit, decrease size to reduce risk of dropping frames or stalling
            this.currentChunkSize = Math.max(this.options.minChunkSize, this.currentChunkSize * 0.8);
        } else if (rtf < 0.5) {
            // Very fast, can increase size to improve throughput (less overhead)
            this.currentChunkSize = Math.min(this.options.maxChunkSize, this.currentChunkSize * 1.2);
        }
    }

    private accumulateOutput(
        outputBuffer: Float32Array,
        chunkBuffer: Float32Array,
        startSample: number,
        channels: number,
        overlapSamples: number,
        totalSamples: number
    ) {
        // This is a simplified overlap-add. 
        // Real implementation should use windowing functions (Hann/Hamming).
        // Here we just write, but we need to handle the overlap mixing.

        const chunkLength = chunkBuffer.length;
        const chunkSamples = chunkLength / channels;

        // For standard OLA with 50% overlap and Hann window:
        // signal[i] += chunk[i] * window[i]
        // But here we have variable overlap.

        // Let's just do a linear crossfade for the overlap region.
        // The start of this chunk overlaps with the end of previous chunk.

        for (let i = 0; i < chunkLength; i++) {
            const sampleIndex = i / channels; // integer part is sample index
            const globalSampleIndex = startSample + Math.floor(sampleIndex);

            if (globalSampleIndex * channels + (i % channels) >= outputBuffer.length) continue;

            // Simple addition for now, assuming windowing is handled or we rely on just "add".
            // If we just "add", we need to window the input or output to sum to 1.
            // If we don't window, we get amplitude boost in overlap.

            // Basic Crossfade logic:
            // If in first 'overlapSamples' of this chunk (except first chunk): fade in.
            // If in last 'overlapSamples' of this chunk (except last chunk): fade out.

            let gain = 1.0;
            const currentSampleInChunk = Math.floor(sampleIndex);

            // Fade In (if not start of file)
            if (startSample > 0 && currentSampleInChunk < overlapSamples) {
                gain = currentSampleInChunk / overlapSamples;
            }

            // Fade Out (if not end of file) - we don't know if it's end of file easily here without passing it
            // but we can assume we overlap unless it's the very last part.
            // Actually, we process sequentially, so we write the "fade out" part which will be "faded in" by next chunk.
            if (currentSampleInChunk >= chunkSamples - overlapSamples && (startSample + chunkSamples) < totalSamples) {
                gain = (chunkSamples - currentSampleInChunk) / overlapSamples;
            }

            // Write to output
            // We add to existing?
            // If we zeroed output, we add. 
            // output[global] += chunk[local] * gain

            outputBuffer[globalSampleIndex * channels + (i % channels)] += chunkBuffer[i] * gain;
        }
    }
}
