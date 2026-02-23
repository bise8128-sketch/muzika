/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * WhisperEngine — Browser-side transcription using Whisper ONNX.
 */

import { pipeline, env } from '@xenova/transformers';
import { LrcGenerator } from '../karaoke/LrcGenerator';

// Configure transformers.js environments if needed (we'll fetch quantized from remote HF by default)
env.allowLocalModels = false;

import { ModelInfo, ModelDownloadProgress } from '@/types/model';

export interface WhisperResult {
    text: string;
    segments: WhisperSegment[];
}

export interface WhisperSegment {
    text: string;
    start: number;
    end: number;
    words?: WhisperWord[];
}

export interface WhisperWord {
    word: string;
    start: number;
    end: number;
    probability: number;
}

export class WhisperEngine {
    private transcriber: any = null;

    async load(modelInfo: ModelInfo, onProgress?: (p: ModelDownloadProgress) => void) {
        // Load the pipeline
        this.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
            quantized: true,
            progress_callback: (info: { status: string; progress?: number; loaded?: number; total?: number }) => {
                if (onProgress && info.status === 'progress') {
                    // Convert to expected ModelDownloadProgress
                    onProgress({ 
                        percentage: info.progress || 0,
                        loaded: info.loaded || 0,
                        total: info.total || 0
                    });
                }
            }
        });
    }

    /**
     * Transcribe audio data. 
     * Expects mono Float32Array at 16kHz.
     */
    async transcribe(audio: Float32Array): Promise<WhisperResult> {
        if (!this.transcriber) throw new Error('WhisperEngine not loaded');

        // Execute inference natively using WebAssembly/WebGPU under the hood
        const output = await this.transcriber(audio, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: 'word'
        });

        // The output chunks are at the word level because we asked for 'word' timestamps
        const segments: WhisperSegment[] = [];

        if (output.chunks && Array.isArray(output.chunks)) {
            for (const chunk of output.chunks) {
                // If the model fails to emit a valid second timestamp, assume a small delta
                const start = chunk.timestamp[0];
                const end = chunk.timestamp[1] !== null ? chunk.timestamp[1] : start + 0.5;
                const text = chunk.text;

                segments.push({
                    text: text,
                    start: start,
                    end: end,
                    words: [
                        {
                            word: text.trim(),
                            start: start,
                            end: end,
                            probability: 1.0 // Defaulting to 1.0 as probabilities aren't always surfaced in word chunks
                        }
                    ]
                });
            }
        }
        return {
            text: output.text,
            segments
        };
    }

    /**
     * Transcribe audio data and return LRC formatted string.
     */
    async transcribeToLrc(audio: Float32Array): Promise<string> {
        const result = await this.transcribe(audio);
        return LrcGenerator.generate(result.segments);
    }
}
