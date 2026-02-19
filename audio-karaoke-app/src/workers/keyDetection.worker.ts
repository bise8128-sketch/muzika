/**
 * keyDetection.worker — Offloads chromagram analysis and
 * Krumhansl-Kessler key correlation to a background thread.
 *
 * Keeps the main thread (and 60 fps visualizers) stutter-free
 * even on lower-end / mobile devices.
 *
 * Message protocol:
 *   IN  → { type: 'ANALYZE_KEY', payload: { channelData: Float32Array, sampleRate: number } }
 *   OUT ← { type: 'KEY_RESULT',  payload: KeyInfo }
 *   OUT ← { type: 'ERROR',       payload: { message: string } }
 *
 * The Float32Array is transferred (zero-copy) to avoid blocking
 * the main thread with a structured-clone of a large buffer.
 */

import { analyzeKeyFromPCM } from '../utils/audio/keyDetectionCore';
import type { KeyInfo } from '../utils/audio/keyDetectionCore';

// Re-export so consumers can import the type from the worker module if desired
export type { KeyInfo };

export type KeyWorkerRequest =
    | { type: 'ANALYZE_KEY'; payload: { channelData: Float32Array; sampleRate: number } };

export type KeyWorkerResponse =
    | { type: 'KEY_RESULT'; payload: KeyInfo }
    | { type: 'ERROR'; payload: { message: string } };

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<KeyWorkerRequest>) => {
    const { type, payload } = e.data;

    if (type === 'ANALYZE_KEY') {
        try {
            const { channelData, sampleRate } = payload;

            if (!(channelData instanceof Float32Array) || channelData.length === 0) {
                throw new Error('ANALYZE_KEY requires a non-empty Float32Array as channelData.');
            }
            if (!sampleRate || sampleRate <= 0) {
                throw new Error('ANALYZE_KEY requires a positive sampleRate.');
            }

            const keyInfo = analyzeKeyFromPCM(channelData, sampleRate);

            (self as unknown as Worker).postMessage({
                type: 'KEY_RESULT',
                payload: keyInfo,
            } satisfies KeyWorkerResponse);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[keyDetection.worker] Error:', message);

            (self as unknown as Worker).postMessage({
                type: 'ERROR',
                payload: { message },
            } satisfies KeyWorkerResponse);
        }
    }
};

self.onerror = (event) => {
    const msg = event instanceof ErrorEvent ? event.message : 'Unknown worker error';
    console.error('[keyDetection.worker] Uncaught error:', msg);
    try {
        (self as unknown as Worker).postMessage({
            type: 'ERROR',
            payload: { message: `Uncaught worker error: ${msg}` },
        } satisfies KeyWorkerResponse);
    } catch {
        // Nothing more we can do
    }
};
