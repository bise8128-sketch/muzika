import { useState, useCallback, useRef, useEffect } from 'react';
import type { WorkerRequest, WorkerResponse, SeparationChunkPayload } from '@/types/worker';
import type { ModelInfo, ModelDownloadProgress } from '@/types/model';

export interface SeparationState {
    isProcessing: boolean;
    progress: number;
    status: 'idle' | 'loading-model' | 'downloading' | 'separating' | 'completed' | 'error';
    error: string | null;
}

export function useSeparation() {
    const [state, setState] = useState<SeparationState>({
        isProcessing: false,
        progress: 0,
        status: 'idle',
        error: null,
    });

    const workerRef = useRef<Worker | null>(null);

    // Initialize worker on demand
    const getWorker = useCallback(() => {
        if (!workerRef.current) {
            workerRef.current = new Worker(
                new URL('../workers/audioSeparationWorker.ts', import.meta.url)
            );

            workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
                const { type, payload } = event.data;

                switch (type) {
                    case 'PROGRESS':
                        if (payload.status === 'downloading') {
                            const p = payload.progress as ModelDownloadProgress;
                            setState(s => ({ ...s, status: 'downloading', progress: p.percentage }));
                        } else {
                            setState(s => ({ ...s, status: payload.status }));
                        }
                        break;

                    case 'SUCCESS':
                        // Logic for handling results will be added here
                        break;

                    case 'ERROR':
                        setState(s => ({
                            ...s,
                            isProcessing: false,
                            status: 'error',
                            error: payload.message
                        }));
                        break;

                    default:
                        break;
                }
            };
        }
        return workerRef.current;
    }, []);

    const separateAudio = useCallback(async (
        audioBuffer: AudioBuffer,
        modelInfo: ModelInfo
    ) => {
        setState({ isProcessing: true, progress: 0, status: 'loading-model', error: null });

        const worker = getWorker();

        // First, ensure model is loaded
        worker.postMessage({
            type: 'LOAD_MODEL',
            payload: modelInfo
        } as WorkerRequest);

        // Note: The actual chunking and batch processing will be implemented in Phase 3.
        // This hook will eventually handle the coordination of multiple SEPARATE_CHUNK calls.
    }, [getWorker]);

    const cancel = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
        setState({ isProcessing: false, progress: 0, status: 'idle', error: null });
    }, []);

    useEffect(() => {
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, []);

    return {
        ...state,
        separateAudio,
        cancel
    };
}
