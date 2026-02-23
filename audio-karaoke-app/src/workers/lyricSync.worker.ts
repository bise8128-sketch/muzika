/**
 * lyricSync.worker — Offloads transcription and alignment to a Web Worker.
 *
 * Messages:
 *   IN  → { type: 'TRANSCRIBE', payload: { audioData: Float32Array, sampleRate: number, lyrics: string[] } }
 *   OUT ← { type: 'PROGRESS', payload: SyncProgress }
 *   OUT ← { type: 'RESULT',   payload: SyncResult }
 *   OUT ← { type: 'ERROR',    payload: { message: string } }
 */

import type { SyncProgress, SyncResult, WhisperSegment } from '../utils/ml/lyricSync';
import { alignLyricsToTranscription } from '../utils/ml/lyricSync';

import { WhisperEngine } from '../utils/ml/whisperEngine';
import { ModelInfo, ModelType } from '@/types/model';

async function transcribeAudio(
    audioData: Float32Array,
    sampleRate: number,
    onProgress: (p: SyncProgress) => void
): Promise<WhisperSegment[]> {
    // 1. Initialize Engine
    const engine = new WhisperEngine();
    
    // Whisper model info (usually tiny for browser use)
    const whisperModel: ModelInfo = {
        id: 'whisper-tiny-en',
        type: ModelType.WHISPER,
        name: 'Whisper Tiny (English)',
        version: '1.0',
        size: 40 * 1024 * 1024,
        url: '/models/whisper-tiny-en.onnx'
    };

    onProgress({ stage: 'loading-model', progress: 0.1, message: 'Loading AI model...' });
    
    await engine.load(whisperModel, (p: any) => {
        onProgress({ 
            stage: 'loading-model', 
            progress: 0.1 + (p.percentage / 100) * 0.2, 
            message: `Downloading model: ${Math.round(p.percentage)}%` 
        });
    });

    // 2. Transcribe
    onProgress({ stage: 'transcribing', progress: 0.3, message: 'Analyzing audio transcription...' });
    
    const transcription = await engine.transcribe(audioData, (inferenceProgress: number) => {
        // Map 0-100 to 0.3-0.9 for the 'transcribing' stage
        const mappedProgress = 0.3 + (inferenceProgress / 100) * 0.6;
        onProgress({
            stage: 'transcribing',
            progress: mappedProgress,
            message: `Analyzing audio... ${Math.round(inferenceProgress)}%`
        });
    });
    
    return transcription.segments as WhisperSegment[];
}

function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

// ── Worker message handler ──────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'TRANSCRIBE') {
        const { audioData, sampleRate, lyrics } = payload as {
            audioData: Float32Array;
            sampleRate: number;
            lyrics: string[];
        };

        try {
            const postProgress = (p: SyncProgress) =>
                self.postMessage({ type: 'PROGRESS', payload: p });

            // Step 1: Transcribe
            const segments = await transcribeAudio(audioData, sampleRate, postProgress);

            // Step 2: Align
            postProgress({ stage: 'aligning', progress: 0, message: 'Aligning lyrics…' });
            const result: SyncResult = alignLyricsToTranscription(segments, lyrics);
            postProgress({ stage: 'done', progress: 1, message: 'Sync complete.' });

            self.postMessage({ type: 'RESULT', payload: result });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            self.postMessage({ type: 'ERROR', payload: { message } });
        }
    }
};
