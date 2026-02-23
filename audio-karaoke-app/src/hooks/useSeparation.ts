import { useState, useCallback, useRef, useEffect } from 'react';
import type { ModelInfo } from '@/types/model';
import type { SeparationResult, ProcessingProgress } from '@/types/audio';
import { separateAudio } from '@/utils/ml/separateAudio';
import { db } from '@/utils/storage/audioDatabase';
import { LyricService } from '@/utils/karaoke/LyricService';

export interface SeparationState {
    isProcessing: boolean;
    progress: number;
    status: 'idle' | 'processing' | 'completed' | 'error';
    currentPhase: ProcessingProgress['phase'] | null;

    message: string | null;
    error: string | null;
    result: SeparationResult | null;
    executionBackend: 'webgpu' | 'wasm' | 'server' | null;
}

export function useSeparation() {
    const [state, setState] = useState<SeparationState>({
        isProcessing: false,
        progress: 0,
        status: 'idle',
        currentPhase: null,
        message: null,
        error: null,
        result: null,
        executionBackend: null,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    const separate = useCallback(async (
        file: File,
        modelInfo: ModelInfo,
        skipCache: boolean = false,
        metadata?: { artist?: string; title?: string; duration?: number }
    ) => {
        // Reset state
        setState({
            isProcessing: true,
            progress: 0,
            status: 'processing',
            currentPhase: 'loading-model',
            message: 'Starting separation...',
            error: null,
            result: null,
            executionBackend: null,
        });

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const result = await separateAudio(file, {
                modelInfo,
                skipCache,
                signal: abortControllerRef.current.signal,
                onProgress: (p) => {
                    setState(s => ({
                        ...s,
                        progress: p.percentage,
                        currentPhase: p.phase,
                        message: p.message || null,
                        executionBackend: p.executionBackend || s.executionBackend
                    }));
                },
            });

            // Automatic Lyric Alignment (Unified Service)
            let lyrics: string | undefined;
            try {
                const title = metadata?.title || file.name.replace(/\.[^/.]+$/, "");
                const artist = metadata?.artist;
                const duration = metadata?.duration;

                console.log(`[useSeparation] Acquiring lyrics for ${title}`);
                const lrc = await LyricService.acquireLyrics(result.vocals, {
                    artist,
                    title,
                    duration
                });
                
                if (lrc) {
                    lyrics = lrc;
                    // Also update the cache if it was just saved
                    await db.cachedAudio
                        .where('[fileHash+modelUsed]')
                        .equals([result.fileHash, modelInfo.id])
                        .modify({ lyrics: lrc });
                }
            } catch (lyricError) {
                console.warn('[useSeparation] Failed to acquire lyrics:', lyricError);
            }

            const resultWithLyrics = {
                ...result,
                lyrics
            };

            setState(s => ({
                ...s,
                isProcessing: false,
                status: 'completed',
                message: 'Separation completed successfully!',
                result: resultWithLyrics,
            }));

            return resultWithLyrics;

        } catch (error: unknown) {
            if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Aborted')) {
                return undefined;
            }
            const message = error instanceof Error ? error.message : 'Unknown error occurred during separation';
            setState(s => ({
                ...s,
                isProcessing: false,
                status: 'error',
                error: message,
                message: null,
            }));
            // Don't re-throw: callers read error state via the hook's return value
            return undefined;
        }
    }, []);

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setState({
            isProcessing: false,
            progress: 0,
            status: 'idle',
            currentPhase: null,
            message: 'Processing cancelled',
            error: null,
            result: null,
            executionBackend: null,
        });
    }, []);

    const reset = useCallback(() => {
        setState({
            isProcessing: false,
            progress: 0,
            status: 'idle',
            currentPhase: null,
            message: null,
            error: null,
            result: null,
            executionBackend: null,
        });
    }, []);

    useEffect(() => {
        const bc = new BroadcastChannel('muzika-sw-channel');
        
        const handleMessage = (event: MessageEvent) => {
            const { type, payload } = event.data;
            
            switch (type) {
                case 'DOWNLOAD_START':
                    setState(s => ({ ...s, message: `Starting model cache: ${payload.url.split('/').pop()}` }));
                    break;
                case 'DOWNLOAD_COMPLETE':
                    setState(s => ({ ...s, message: 'Model successfully cached for offline use.' }));
                    setTimeout(() => setState(s => ({ ...s, message: s.message === 'Model successfully cached for offline use.' ? null : s.message })), 3000);
                    break;
                case 'DOWNLOAD_ERROR':
                    setState(s => ({ ...s, error: `Cache failed: ${payload.error}` }));
                    break;
                case 'CACHE_HIT':
                    console.log('[useSeparation] Offline Cache Hit:', payload.url);
                    break;
            }
        };

        bc.onmessage = handleMessage;

        return () => {
            bc.close();
        };
    }, []);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return {
        ...state,
        separate,
        cancel,
        reset,
    };
}
