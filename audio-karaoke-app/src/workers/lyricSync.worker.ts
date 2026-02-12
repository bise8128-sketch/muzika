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

// ── Whisper stub ────────────────────────────────────────────────
// In a real implementation this would load the Whisper ONNX model
// via onnxruntime-web and run inference.  This stub simulates the
// pipeline so the integration can be tested end-to-end.

async function transcribeAudio(
    audioData: Float32Array,
    sampleRate: number,
    onProgress: (p: SyncProgress) => void
): Promise<WhisperSegment[]> {
    // 1. Model loading (simulated)
    onProgress({ stage: 'loading-model', progress: 0, message: 'Loading Whisper model…' });
    await delay(100);
    onProgress({ stage: 'loading-model', progress: 1, message: 'Model ready.' });

    // 2. Transcribe (simulated — in production, run ONNX inference here)
    onProgress({ stage: 'transcribing', progress: 0, message: 'Transcribing audio…' });
    await delay(200);

    // Generate placeholder segments based on audio duration
    const duration = audioData.length / sampleRate;
    const segmentCount = Math.max(1, Math.floor(duration / 5));
    const segments: WhisperSegment[] = [];
    for (let i = 0; i < segmentCount; i++) {
        const start = (i / segmentCount) * duration;
        const end = ((i + 1) / segmentCount) * duration;
        segments.push({
            text: `[segment ${i + 1}]`,
            start,
            end,
            words: [{ word: `[segment ${i + 1}]`, start, end, probability: 0.8 }],
        });
        onProgress({
            stage: 'transcribing',
            progress: (i + 1) / segmentCount,
            message: `Transcribing… ${Math.round(((i + 1) / segmentCount) * 100)}%`,
        });
    }

    return segments;
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
