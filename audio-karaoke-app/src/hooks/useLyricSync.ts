'use client';

/**
 * useLyricSync — React hook for AI-powered lyric synchronization.
 *
 * Manages the worker lifecycle, progress tracking, and result state.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { SyncProgress, SyncResult } from '@/utils/ml/lyricSync';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import { audioCache } from '@/utils/storage/audioCache';
import { lyricSyncCache } from '@/utils/storage/lyricSyncCache';

interface LyricSyncState {
    isProcessing: boolean;
    progress: SyncProgress | null;
    result: SyncResult | null;
    error: string | null;
}

export function useLyricSync(controller: PlaybackController) {
    const [state, setState] = useState<LyricSyncState>({
        isProcessing: false,
        progress: null,
        result: null,
        error: null,
    });

    const workerRef = useRef<Worker | null>(null);

    // Create worker lazily
    const getWorker = useCallback(() => {
        if (!workerRef.current) {
            workerRef.current = new Worker(
                new URL('../workers/lyricSync.worker.ts', import.meta.url)
            );
        }
        return workerRef.current;
    }, []);

    // Start synchronisation
    const startSync = useCallback((lyrics: string[]) => {
        const buffers = controller.getAudioBuffers();
        if (buffers.length === 0) {
            setState(prev => ({ ...prev, error: 'No audio loaded.' }));
            return;
        }

        // Use the first buffer (vocals) for transcription
        const buffer = buffers[0];
        const audioData = buffer.getChannelData(0);
        const sampleRate = buffer.sampleRate;

        setState({
            isProcessing: true,
            progress: { stage: 'loading-model', progress: 0, message: 'Starting…' },
            result: null,
            error: null,
        });

        const runSync = async () => {
            const file = controller.getOriginalFile();
            const modelUsed = 'whisper-tiny-en'; // Match worker config
            let fileHash = '';

            if (file) {
                fileHash = await audioCache.hashFile(file);
                // Check cache first
                const cachedSync = await lyricSyncCache.getCachedSync(fileHash, modelUsed);
                if (cachedSync) {
                    setState(prev => ({
                        ...prev,
                        isProcessing: false,
                        result: cachedSync,
                        progress: { stage: 'done', progress: 1, message: 'Loaded from cache!' },
                    }));
                    return;
                }
            }

            const worker = getWorker();

        worker.onmessage = async (e: MessageEvent) => {
            const { type, payload } = e.data;

            if (type === 'PROGRESS') {
                setState(prev => ({ ...prev, progress: payload as SyncProgress }));
            } else if (type === 'RESULT') {
                const syncResult = payload as SyncResult;
                if (fileHash) {
                    // Fire and forget cache save
                    lyricSyncCache.cacheSyncResult(fileHash, modelUsed, syncResult).catch(() => {});
                }
                
                setState(prev => ({
                    ...prev,
                    isProcessing: false,
                    result: syncResult,
                    progress: { stage: 'done', progress: 1, message: 'Done!' },
                }));
            } else if (type === 'ERROR') {
                setState(prev => ({
                    ...prev,
                    isProcessing: false,
                    error: payload.message,
                    progress: { stage: 'error', progress: 0, message: payload.message },
                }));
            }
        };

        worker.postMessage({
            type: 'TRANSCRIBE',
            payload: { audioData, sampleRate, lyrics },
        });
        };

        runSync();
    }, [controller, getWorker]);

    // Cancel processing
    const cancelSync = useCallback(() => {
        workerRef.current?.terminate();
        workerRef.current = null;
        setState({
            isProcessing: false,
            progress: null,
            result: null,
            error: null,
        });
    }, []);

    // Reset
    const resetSync = useCallback(() => {
        setState({
            isProcessing: false,
            progress: null,
            result: null,
            error: null,
        });
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    return {
        ...state,
        startSync,
        cancelSync,
        resetSync,
    };
}
